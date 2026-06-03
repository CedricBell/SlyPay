import { EarningType, SpendCategory } from "@prisma/client";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { walletCardInclude } from "@/lib/credit-card-rules";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { mapCreditCardJson } from "@/lib/map-credit-card";
import { runCardIntelJob } from "@/server/card-intelligence/run-intel-job";
import {
  applyCatalogRulesIfMissing,
  catalogExtractIsReady,
} from "@/server/catalog-reward-rules";
import {
  ensureAdHocCatalogProduct,
  resolveCatalogProductFromSlug,
} from "@/server/catalog-db-sync";
import { isAdHocCatalogIntelEligible } from "@/server/catalog-intel-eligibility";
import { resolveUserCardInput } from "@/server/wallet-card-resolve";

const createBody = z.object({
  name: z.string().min(2).max(120).optional(),
  issuer: z.string().min(2).max(120).optional(),
  rawQuery: z.string().min(2).max(240).optional(),
  last4: z.string().max(4).optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isActive: z.boolean().optional(),
  catalogSlug: z.string().min(2).max(120).optional(),
  intelAdHocFromName: z.boolean().optional(),
});

export async function GET() {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.creditCard.findMany({
    where: { userId: ctx.appUser.id },
    orderBy: { createdAt: "desc" },
    include: walletCardInclude,
  });
  return NextResponse.json(rows.map((c) => mapCreditCardJson(c)));
}

export async function POST(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof createBody>;
  try {
    body = createBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof z.ZodError ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  let name = body.name?.trim() ?? "";
  let issuer = body.issuer?.trim() ?? "";
  const rawQuery = body.rawQuery?.trim() ?? "";

  if (rawQuery) {
    const resolved = resolveUserCardInput(rawQuery);
    if (resolved) {
      if (!name) name = resolved.name;
      if (!issuer) issuer = resolved.issuer;
    }
  }

  if (name.length < 2 || issuer.length < 2) {
    return NextResponse.json(
      { message: "Enter a bank and card name (at least 2 characters each)." },
      { status: 400 },
    );
  }

  let catalogSlug: string | undefined;
  let runIntelAdHoc = body.intelAdHocFromName ?? false;

  if (body.catalogSlug) {
    const row = await resolveCatalogProductFromSlug(body.catalogSlug);
    if (!row) {
      return NextResponse.json(
        { message: "Unknown catalog slug — pick a suggestion or omit catalogSlug." },
        { status: 400 },
      );
    }
    catalogSlug = row.slug;
  } else if (runIntelAdHoc) {
    const lookupQuery = rawQuery || `${issuer} ${name}`.trim();
    if (!isAdHocCatalogIntelEligible(lookupQuery)) {
      runIntelAdHoc = false;
    }
    if (runIntelAdHoc) {
      const row = await ensureAdHocCatalogProduct({
        name,
        issuer,
        colorHex: body.colorHex ?? null,
      });
      catalogSlug = row.slug;
    }
  }

  const card = await prisma.$transaction(async (tx) => {
    const c = await tx.creditCard.create({
      data: {
        userId: ctx.appUser.id,
        name,
        issuer,
        last4: body.last4,
        colorHex: body.colorHex,
        isActive: body.isActive ?? true,
        catalogProductSlug: catalogSlug,
      },
      include: walletCardInclude,
    });
    if (catalogSlug) {
      await applyCatalogRulesIfMissing(tx, catalogSlug);
    }
    return tx.creditCard.findFirstOrThrow({
      where: { id: c.id },
      include: walletCardInclude,
    });
  });

  let catalogIntelQueued = false;
  if (catalogSlug) {
    const product = await prisma.cardCatalogProduct.findUnique({
      where: { slug: catalogSlug },
      select: { lastExtractHash: true, lastExtractJson: true },
    });
    catalogIntelQueued = !catalogExtractIsReady(product);

    if (catalogIntelQueued) {
      after(async () => {
        await runCardIntelJob({
          productSlug: catalogSlug,
          creditCardId: card.id,
        });
      });
    }
  }

  const cardWithRules = catalogSlug
    ? await prisma.creditCard.findFirstOrThrow({
        where: { id: card.id },
        include: walletCardInclude,
      })
    : card;

  return NextResponse.json({
    ...mapCreditCardJson(cardWithRules),
    catalogIntelQueued,
  });
}
