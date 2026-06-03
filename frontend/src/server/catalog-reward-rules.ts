import { EarningType, type Prisma } from "@prisma/client";
import { applyBenefitsFromExtract } from "@/server/catalog-benefits";
import { mapExtractToRewardRules } from "@/server/card-intelligence/map-extract-to-reward-rules";
import { rewardsExtractSchema } from "@/server/card-intelligence/rewards-extract-schema";
import {
  sanitizeRewardRuleDrafts,
  type RewardRuleDraft,
} from "@/server/reward-rules-sanitize";

export async function rewardRulesFromCatalogExtract(product: {
  name: string;
  issuer: string;
  lastExtractJson: unknown;
}): Promise<RewardRuleDraft[] | null> {
  if (product.lastExtractJson == null) return null;
  const extract = rewardsExtractSchema.parse(product.lastExtractJson);
  const drafts = await mapExtractToRewardRules({
    productName: product.name,
    issuer: product.issuer,
    extract,
  });
  return sanitizeRewardRuleDrafts(drafts);
}

export async function applyRewardRulesToCatalogProduct(
  tx: Prisma.TransactionClient,
  catalogProductSlug: string,
  sanitized: RewardRuleDraft[],
): Promise<void> {
  await tx.rewardRule.deleteMany({ where: { catalogProductSlug } });
  if (!sanitized.length) return;
  await tx.rewardRule.createMany({
    data: sanitized.map((r, i) => ({
      catalogProductSlug,
      category: r.category,
      multiplier: r.multiplier,
      earningType: r.earningType ?? EarningType.POINTS,
      capAmountMonthly: r.capAmountMonthly ?? null,
      priority: r.priority ?? i,
      notes: r.notes ?? null,
      excludedMerchants: r.excludedMerchants ?? [],
    })),
  });
}

export async function applyExtractSnapshotToCatalog(
  tx: Prisma.TransactionClient,
  catalogProductSlug: string,
  extract: unknown,
  sanitized: RewardRuleDraft[],
): Promise<void> {
  const parsed = rewardsExtractSchema.parse(extract);
  await applyRewardRulesToCatalogProduct(tx, catalogProductSlug, sanitized);
  await applyBenefitsFromExtract(tx, catalogProductSlug, parsed);
}

/** Applies catalog extract → RewardRule when the product has none yet. */
export async function applyCatalogRulesIfMissing(
  tx: Prisma.TransactionClient,
  catalogSlug: string,
): Promise<boolean> {
  const existing = await tx.rewardRule.count({ where: { catalogProductSlug: catalogSlug } });
  if (existing > 0) return false;

  const product = await tx.cardCatalogProduct.findUnique({
    where: { slug: catalogSlug },
    select: { name: true, issuer: true, lastExtractJson: true },
  });
  if (!product?.lastExtractJson) return false;

  const sanitized = await rewardRulesFromCatalogExtract(product);
  if (!sanitized?.length) return false;

  await applyRewardRulesToCatalogProduct(tx, catalogSlug, sanitized);
  return true;
}

export function catalogExtractIsReady(product: {
  lastExtractHash: string | null;
  lastExtractJson: unknown;
} | null): boolean {
  return Boolean(product?.lastExtractHash && product?.lastExtractJson != null);
}
