import { EarningType, SpendCategory } from "@prisma/client";
import type { RewardsExtract } from "@/server/card-intelligence/rewards-extract-schema";
import { spendCategoryFromHint } from "@/server/card-intelligence/rewards-extract-schema";
import {
  sanitizeRewardRuleDrafts,
  type RewardRuleDraft,
} from "@/server/reward-rules-sanitize";

function parseMultiplierFromDescription(desc: string): {
  multiplier: number;
  earningType: EarningType;
} {
  const d = desc.toLowerCase();
  const xMatch = d.match(/(\d+(?:\.\d+)?)\s*x\b/);
  if (xMatch) {
    return {
      multiplier: Number(xMatch[1]),
      earningType: EarningType.POINTS,
    };
  }
  const pctMatch = d.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);
  if (pctMatch) {
    return {
      multiplier: Number(pctMatch[1]),
      earningType: EarningType.CASHBACK_PERCENT,
    };
  }
  const ppd = d.match(/(\d+(?:\.\d+)?)\s*(?:bonus\s+)?points?\s+per\s+\$?\s*1/);
  if (ppd) {
    return {
      multiplier: Number(ppd[1]),
      earningType: EarningType.POINTS,
    };
  }
  const miles = d.match(/(\d+(?:\.\d+)?)\s*miles?\s+per\s+\$?\s*1/);
  if (miles) {
    return {
      multiplier: Number(miles[1]),
      earningType: EarningType.MILES,
    };
  }
  return { multiplier: 1, earningType: EarningType.POINTS };
}

/** Deterministic earn-rate → RewardRule mapping (no second LLM call). */
export function mapExtractToRewardRulesHeuristic(
  extract: RewardsExtract,
): RewardRuleDraft[] {
  const drafts: RewardRuleDraft[] = [];
  for (const rate of extract.earnRates) {
    const category =
      spendCategoryFromHint(rate.categoryHint) ?? SpendCategory.OTHER;
    const { multiplier, earningType } = parseMultiplierFromDescription(
      `${rate.multiplierDescription} ${rate.categoryHint}`,
    );
    drafts.push({
      category,
      multiplier,
      earningType,
      priority: drafts.length,
      notes: rate.notes ?? rate.capText ?? undefined,
      excludedMerchants: rate.excludedMerchants?.length
        ? rate.excludedMerchants
        : undefined,
    });
  }
  return sanitizeRewardRuleDrafts(drafts);
}
