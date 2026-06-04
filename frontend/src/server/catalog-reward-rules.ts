import { EarningType, type Prisma } from "@prisma/client";
import { applyBenefitsFromExtract } from "@/server/catalog-benefits";
import { buildRewardRuleDraftsFromExtract } from "@/server/card-intelligence/build-reward-rule-drafts";
import { parseRewardsExtract } from "@/server/card-intelligence/rewards-extract-schema";
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
  const extract = parseRewardsExtract(product.lastExtractJson);
  return buildRewardRuleDraftsFromExtract({
    productName: product.name,
    issuer: product.issuer,
    extract,
  });
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
  const parsed = parseRewardsExtract(extract);
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

export function extractHasEarnRates(lastExtractJson: unknown): boolean {
  if (lastExtractJson == null) return false;
  try {
    return parseRewardsExtract(lastExtractJson).earnRates.length > 0;
  } catch {
    return false;
  }
}

/** Catalog intel is reusable for the next wallet card when rules exist or extract has earn rates. */
export function catalogRewardsReady(
  product: {
    lastExtractHash: string | null;
    lastExtractJson: unknown;
  } | null,
  rewardRuleCount: number,
): boolean {
  if (rewardRuleCount > 0) return true;
  return Boolean(
    product?.lastExtractHash &&
      product.lastExtractJson != null &&
      extractHasEarnRates(product.lastExtractJson),
  );
}

export function catalogExtractIsReady(product: {
  lastExtractHash: string | null;
  lastExtractJson: unknown;
} | null): boolean {
  return Boolean(product?.lastExtractHash && product?.lastExtractJson != null);
}
