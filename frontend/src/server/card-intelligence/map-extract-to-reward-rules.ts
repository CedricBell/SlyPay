import { EarningType, SpendCategory } from "@prisma/client";
import { cardIntelCompleteJson } from "@/server/card-intelligence/card-intel-llm";
import { z } from "zod";
import type { RewardsExtract } from "@/server/card-intelligence/rewards-extract-schema";
import type { RewardRuleDraft } from "@/server/reward-rules-sanitize";

const mappedRuleSchema = z.object({
  category: z.nativeEnum(SpendCategory),
  multiplier: z.number().min(0).max(1000),
  earningType: z.nativeEnum(EarningType),
  notes: z.string().optional(),
  excludedMerchants: z.array(z.string()).optional(),
});

const mappedRulesSchema = z.array(mappedRuleSchema);

const SYSTEM = `You convert credit-card reward extracts into normalized rule rows for our app.

Output JSON array only. Each item:
- category: one of GROCERIES, DINING, TRAVEL, GAS, ONLINE_SHOPPING, DRUGSTORES, ENTERTAINMENT, WHOLESALE, OTHER
- multiplier: For CASHBACK_PERCENT this is the percent per dollar (e.g. 2 means 2%). For POINTS or MILES this is points/miles per dollar.
- earningType: CASHBACK_PERCENT for flat cashback; POINTS for membership/points; MILES for mileage.
- notes: short caveat (caps, enrollment) from the extract.
- excludedMerchants: merchant/brand names excluded from THIS category earn (e.g. ["Target","Walmart"] for groceries). Copy from earnRates[].excludedMerchants and globalExcludedMerchants when relevant.

Rules:
- Prefer specifics from earnRates; map vague merchant wording to closest SpendCategory.
- Preserve ALL merchant exclusions per category — critical for grocery/dining rules.
- Always include an OTHER rule for documented base/default earn when inferable.
- If the extract describes quarterly rotating 5% categories (Discover it, Chase Freedom Flex, etc.), map ONLY the permanent base rate (usually 1% OTHER). Do NOT create permanent category rules at the rotating bonus multiplier — those quarters are managed separately in our rotating calendar.

Respond with JSON: { "rules": [ ... ] }`;

export async function mapExtractToRewardRules(args: {
  productName: string;
  issuer: string;
  extract: RewardsExtract;
}): Promise<RewardRuleDraft[]> {
  const raw = await cardIntelCompleteJson({
    system: SYSTEM,
    user: JSON.stringify({
      cardName: args.productName,
      issuer: args.issuer,
      extract: args.extract,
    }),
  });

  const parsed: unknown = JSON.parse(raw);
  const wrapper = z.object({ rules: mappedRulesSchema }).parse(parsed);

  const globalExclusions = args.extract.globalExcludedMerchants ?? [];

  return wrapper.rules.map((r, i) => {
    const mergedExclusions = [
      ...new Set([
        ...(r.excludedMerchants ?? []),
        ...globalExclusions,
      ]),
    ].filter(Boolean);

    return {
      category: r.category,
      multiplier: r.multiplier,
      earningType: r.earningType,
      priority: i,
      notes: r.notes,
      excludedMerchants: mergedExclusions.length ? mergedExclusions : undefined,
    };
  });
}
