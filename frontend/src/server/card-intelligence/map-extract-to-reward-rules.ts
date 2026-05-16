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
});

const mappedRulesSchema = z.array(mappedRuleSchema);

const SYSTEM = `You convert credit-card reward extracts into normalized rule rows for our app.

Output JSON array only. Each item:
- category: one of GROCERIES, DINING, TRAVEL, GAS, ONLINE_SHOPPING, DRUGSTORES, ENTERTAINMENT, WHOLESALE, OTHER
- multiplier: For CASHBACK_PERCENT this is the percent per dollar (e.g. 2 means 2%). For POINTS or MILES this is points/miles per dollar on eligible spend (e.g. 3 means 3 per $1).
- earningType: CASHBACK_PERCENT for flat cashback cards; POINTS for membership/points currencies; MILES for mileage currencies.
- notes: optional short caveat from the extract (caps, enrollment).

Rules:
- Prefer specifics from earnRates; map vague merchant wording to closest SpendCategory; use OTHER for generic base earn if clearly stated.
- If multiple rates apply to the same category, keep the primary everyday rate from official terms when possible; editorial blocks may mention promos — note them in rule notes when mapping.
- Always include an OTHER rule for the documented base/default earn when inferable; otherwise use multiplier 1 POINTS with a note that base earn was unclear.

Respond with JSON: { "rules": [ ...mapped items... ] }`;

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
  return wrapper.rules.map((r, i) => ({
    category: r.category,
    multiplier: r.multiplier,
    earningType: r.earningType,
    priority: i,
    notes: r.notes,
  }));
}
