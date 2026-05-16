import type { Offer, RewardRule } from "@prisma/client";
import {
  computeHouseholdBenchmarkScore,
  toEngineCardFromWallet,
} from "@/lib/household-benchmark-score";

export type WalletScoreBreakdown = {
  grossRewardsUsd: number;
  statementCreditsUsd: number;
  annualFeeUsd: number;
  netValueUsd: number;
  scoreOutOf100: number;
  spendProfileLabel: string;
};

export type WalletScoreResult = {
  total: number;
  breakdown: WalletScoreBreakdown;
  analyzing: boolean;
};

export { parseAnnualFeeDollarsFromExtract } from "@/lib/wallet-score-extract";

export function computeWalletScore(
  rules: Pick<
    RewardRule,
    | "category"
    | "multiplier"
    | "earningType"
    | "capAmountMonthly"
    | "priority"
  >[],
  catalogExtractJson: unknown,
  opts?: {
    cardId?: string;
    cardName?: string;
    issuer?: string;
    offers?: Pick<
      Offer,
      | "category"
      | "multiplier"
      | "stackPolicy"
      | "validFrom"
      | "validUntil"
      | "title"
    >[];
    rotatingBonusCalendar?: unknown;
  },
): WalletScoreResult {
  if (!rules.length) {
    return {
      total: 0,
      analyzing: true,
      breakdown: {
        grossRewardsUsd: 0,
        statementCreditsUsd: 0,
        annualFeeUsd: 0,
        netValueUsd: 0,
        scoreOutOf100: 0,
        spendProfileLabel: "",
      },
    };
  }

  const engineCard = toEngineCardFromWallet({
    id: opts?.cardId ?? "benchmark",
    name: opts?.cardName ?? "Card",
    issuer: opts?.issuer ?? "",
    rules,
    offers: opts?.offers ?? [],
    rotatingBonusCalendar: opts?.rotatingBonusCalendar,
  });

  const bench = computeHouseholdBenchmarkScore({
    card: engineCard,
    catalogExtractJson,
  });

  return {
    total: bench.scoreOutOf100,
    analyzing: false,
    breakdown: {
      grossRewardsUsd: bench.grossRewardsUsd,
      statementCreditsUsd: bench.statementCreditsUsd,
      annualFeeUsd: bench.annualFeeUsd,
      netValueUsd: bench.netValueUsd,
      scoreOutOf100: bench.scoreOutOf100,
      spendProfileLabel: bench.spendProfileLabel,
    },
  };
}
