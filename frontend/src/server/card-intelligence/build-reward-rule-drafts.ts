import type { RewardsExtract } from "@/server/card-intelligence/rewards-extract-schema";
import { mapExtractToRewardRulesHeuristic } from "@/server/card-intelligence/map-extract-heuristic";
import { mapExtractToRewardRules } from "@/server/card-intelligence/map-extract-to-reward-rules";
import {
  sanitizeRewardRuleDrafts,
  type RewardRuleDraft,
} from "@/server/reward-rules-sanitize";

/** LLM mapping with deterministic fallback from earnRates[]. */
export async function buildRewardRuleDraftsFromExtract(args: {
  productName: string;
  issuer: string;
  extract: RewardsExtract;
}): Promise<RewardRuleDraft[]> {
  let sanitized: RewardRuleDraft[] = [];
  try {
    const llmDrafts = await mapExtractToRewardRules(args);
    sanitized = sanitizeRewardRuleDrafts(llmDrafts);
  } catch {
    /* fall through to heuristic */
  }

  if (sanitized.length > 0) return sanitized;

  return mapExtractToRewardRulesHeuristic(args.extract);
}
