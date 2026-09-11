import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { resolveCatalogImageUrl } from "@/server/catalog-card-art";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { parseRewardsExtract } from "@/server/card-intelligence/rewards-extract-schema";
import { catalogImageSrcForDisplay } from "@/lib/catalog-image-display";
import {
  formatStatementCreditLineFromDisplay,
  statementCreditsFromExtractJson,
} from "@/lib/statement-credit-display";
import { formatProtectionHint } from "@/lib/truncate-display-text";
import { dec } from "@/lib/serialize";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const session = await getSessionAppUser();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  if (!slug?.trim()) {
    return NextResponse.json({ message: "Missing slug" }, { status: 400 });
  }

  const staticEntry = CARD_CATALOG_ENTRIES.find((e) => e.id === slug);

  const product = await prisma.cardCatalogProduct.findUnique({
    where: { slug },
    include: {
      rewardRules: { orderBy: [{ priority: "asc" }, { multiplier: "desc" }] },
      benefits: { orderBy: [{ priority: "asc" }] },
      intelJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const name = product?.name ?? staticEntry?.name ?? slug;
  const issuer = product?.issuer ?? staticEntry?.issuer ?? "Issuer";
  const rawImageUrl = resolveCatalogImageUrl(slug, {
    imageUrl: product?.imageUrl ?? staticEntry?.imageUrl,
    imageLabel: name,
  });
  const imageUrl = catalogImageSrcForDisplay(rawImageUrl);
  const colorHex = product?.colorHex ?? staticEntry?.colorHex ?? "#0f172a";

  let summary: string | null = null;
  let statementCredits: string[] = [];
  let protections: string[] = [];
  let perks: string[] = [];

  if (product?.lastExtractJson) {
    try {
      const extract = parseRewardsExtract(product.lastExtractJson);
      summary = extract.summary?.trim() ?? extract.benefitsSummary?.trim() ?? null;
      statementCredits = statementCreditsFromExtractJson(
        product.lastExtractJson,
        10,
      ).map((c) => formatStatementCreditLineFromDisplay(c));
      protections = (extract.protections ?? [])
        .slice(0, 6)
        .map((p) => formatProtectionHint(p.title, p.coverageSummary));
      perks = (extract.perks ?? []).slice(0, 8).map((p) =>
        [p.title, p.description].filter(Boolean).join(" — "),
      );
    } catch {
      /* ignore stale json */
    }
  }

  const latestJob = product?.intelJobs[0] ?? null;

  return NextResponse.json({
    slug,
    name,
    issuer,
    imageUrl: imageUrl ?? null,
    colorHex,
    hasExtract: Boolean(product?.lastExtractHash),
    rewardRules: (product?.rewardRules ?? []).map((r) => ({
      category: r.category,
      multiplier: dec(r.multiplier),
      earningType: r.earningType,
      notes: r.notes,
      excludedMerchants: r.excludedMerchants,
    })),
    summary,
    statementCredits,
    protections,
    perks,
    intelJob: latestJob
      ? {
          status: latestJob.status,
          errorMessage: latestJob.errorMessage,
          finishedAt: latestJob.finishedAt?.toISOString() ?? null,
        }
      : null,
    inCatalog: Boolean(staticEntry || product),
  });
}
