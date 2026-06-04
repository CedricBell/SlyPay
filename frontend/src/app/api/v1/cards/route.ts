import { EarningType, SpendCategory } from "@prisma/client";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { walletCardInclude, walletCardListInclude } from "@/lib/credit-card-rules";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { mapCreditCardJson } from "@/lib/map-credit-card";
import { runCardIntelJob } from "@/server/card-intelligence/run-intel-job";
import {
  applyCatalogRulesIfMissing,
  catalogRewardsReady,
} from "@/server/catalog-reward-rules";
import {
  ensureAdHocCatalogProduct,
  resolveCatalogProductFromSlug,
} from "@/server/catalog-db-sync";
import { resolveAndPersistCatalogImage } from "@/server/catalog-card-image";
import { isAdHocCatalogIntelEligible } from "@/server/catalog-intel-eligibility";
import { matchStaticCatalogSlug } from "@/server/catalog-infer";
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
    include: walletCardListInclude,
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
    const imageUrl = await resolveAndPersistCatalogImage({
      productSlug: row.slug,
      issuer: row.issuer,
      cardName: row.name,
      currentImageUrl: row.imageUrl,
      officialDocumentUrl: row.officialDocumentUrl,
    });
    if (imageUrl && imageUrl !== row.imageUrl) {
      await prisma.cardCatalogProduct.update({
        where: { slug: row.slug },
        data: { imageUrl },
      });
    }
  } else if (runIntelAdHoc) {
    const lookupQuery = rawQuery || `${issuer} ${name}`.trim();
    if (!isAdHocCatalogIntelEligible(lookupQuery)) {
      runIntelAdHoc = false;
    }
    if (runIntelAdHoc) {
      const staticSlug = matchStaticCatalogSlug(issuer, name);
      if (staticSlug) {
        const row = await resolveCatalogProductFromSlug(staticSlug);
        if (row) catalogSlug = row.slug;
      }
      if (!catalogSlug) {
        const row = await ensureAdHocCatalogProduct({
          name,
          issuer,
          colorHex: body.colorHex ?? null,
        });
        catalogSlug = row.slug;
      }
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
    const [product, ruleCount, lastJob] = await Promise.all([
      prisma.cardCatalogProduct.findUnique({
        where: { slug: catalogSlug },
        select: { lastExtractHash: true, lastExtractJson: true },
      }),
      prisma.rewardRule.count({ where: { catalogProductSlug: catalogSlug } }),
      prisma.cardIntelJob.findFirst({
        where: { productSlug: catalogSlug },
        orderBy: { createdAt: "desc" },
        select: { status: true },
      }),
    ]);

    const rewardsReady = catalogRewardsReady(product, ruleCount);
    catalogIntelQueued = !rewardsReady;

    const shouldRunIntel =
      !rewardsReady ||
      lastJob?.status === "FAILED" ||
      (lastJob?.status === "COMPLETED" && ruleCount === 0);

    if (shouldRunIntel) {
      after(async () => {
        await runCardIntelJob({
          productSlug: catalogSlug,
          creditCardId: card.id,
          forceReanalyze:
            lastJob?.status === "FAILED" ||
            (Boolean(product?.lastExtractHash) && ruleCount === 0),
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
