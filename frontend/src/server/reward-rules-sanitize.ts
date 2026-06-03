import { EarningType, SpendCategory } from "@prisma/client";

export type RewardRuleDraft = {
  category: SpendCategory;
  multiplier: number;
  earningType?: EarningType;
  capAmountMonthly?: number;
  priority?: number;
  notes?: string;
  excludedMerchants?: string[];
};

/** One rule per category — keeps highest multiplier; ensures OTHER baseline. */
export function sanitizeRewardRuleDrafts(
  rules: RewardRuleDraft[],
): RewardRuleDraft[] {
  if (!rules?.length) return [];
  const byCategory = new Map<SpendCategory, RewardRuleDraft>();
  for (const rule of rules) {
    const current = byCategory.get(rule.category);
    if (!current || rule.multiplier > current.multiplier) {
      byCategory.set(rule.category, rule);
    }
  }
  if (!byCategory.has(SpendCategory.OTHER)) {
    byCategory.set(SpendCategory.OTHER, {
      category: SpendCategory.OTHER,
      multiplier: 1,
      earningType: EarningType.POINTS,
      priority: -1,
      notes: "Auto-added fallback rule",
    });
  }
  return [...byCategory.values()];
}
