import { EarningType, SpendCategory, type Offer, type RewardRule } from "@prisma/client";
import { dec } from "@/lib/serialize";
import { parseAnnualFeeDollarsFromExtract } from "@/lib/wallet-score-extract";
import { scoreCardForCategory } from "@/server/decision-engine";
import type { EngineCard, EngineOffer, EngineRule } from "@/server/decision-engine.types";
import {
  mergeEngineOffers,
  rotatingCalendarToEngineOffers,
} from "@/server/rotating-bonus-calendar";

/** Total modeled spend (USD) for the household benchmark. */
export const HOUSEHOLD_BENCHMARK_SPEND_USD = 1000;

/**
 * Card-eligible spend mix inspired by BLS Consumer Expenditure Survey (2023):
 * shares of major categories, scaled to {@link HOUSEHOLD_BENCHMARK_SPEND_USD}.
 * @see https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error-2023.htm
 */
export const BLS_INSPIRED_MONTHLY_SPEND_MIX: Record<SpendCategory, number> = {
  GROCERIES: 220,
  DINING: 130,
  GAS: 80,
  ONLINE_SHOPPING: 180,
  TRAVEL: 120,
  DRUGSTORES: 70,
  ENTERTAINMENT: 100,
  WHOLESALE: 50,
  OTHER: 50,
};

const BASELINE_NET_USD = 8;
const REFERENCE_NET_USD = 48;

export type HouseholdBenchmarkBreakdown = {
  grossRewardsUsd: number;
  statementCreditsUsd: number;
  annualFeeUsd: number;
  netValueUsd: number;
  scoreOutOf100: number;
  spendProfileLabel: string;
  byCategory: Array<{
    category: SpendCategory;
    spendUsd: number;
    rewardUsd: number;
  }>;
};

function parseStatementCreditsAnnualUsd(json: unknown): number {
  if (!json || typeof json !== "object") return 0;
  const sc = (json as { statementCredits?: unknown }).statementCredits;
  if (!Array.isArray(sc)) return 0;
  let total = 0;
  for (const item of sc) {
    if (!item || typeof item !== "object") continue;
    const amt = String((item as { amountText?: string }).amountText ?? "");
    const desc = String((item as { description?: string }).description ?? "");
    const blob = `${amt} ${desc}`;
    const re = /\$[\d,]+(?:\.\d{2})?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(blob)) !== null) {
      const n = Number(m[0].slice(1).replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) total += n;
    }
  }
  return Math.min(total, 12_000);
}

export function toEngineCardFromWallet(args: {
  id: string;
  name: string;
  issuer: string;
  rules: Pick<
    RewardRule,
    "category" | "multiplier" | "earningType" | "capAmountMonthly" | "priority"
  >[];
  offers: Pick<
    Offer,
    | "category"
    | "multiplier"
    | "stackPolicy"
    | "validFrom"
    | "validUntil"
    | "title"
  >[];
  rotatingBonusCalendar?: unknown;
}): EngineCard {
  const manualOffers: EngineOffer[] = args.offers.map((o) => ({
    category: o.category,
    multiplier: dec(o.multiplier),
    stackPolicy: o.stackPolicy,
    validFrom: o.validFrom,
    validUntil: o.validUntil,
    title: o.title,
  }));
  return {
    id: args.id,
    name: args.name,
    issuer: args.issuer,
    rules: args.rules.map((r) => ({
      category: r.category,
      multiplier: dec(r.multiplier),
      earningType: r.earningType,
      capAmountMonthly:
        r.capAmountMonthly != null ? dec(r.capAmountMonthly) : null,
      priority: r.priority,
    })),
    offers: mergeEngineOffers(
      manualOffers,
      rotatingCalendarToEngineOffers(args.rotatingBonusCalendar ?? null),
    ),
  };
}

export function netValueToScoreOutOf100(netValueUsd: number): number {
  const raw =
    ((netValueUsd - BASELINE_NET_USD) / (REFERENCE_NET_USD - BASELINE_NET_USD)) *
    100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function computeHouseholdBenchmarkScore(args: {
  card: EngineCard;
  catalogExtractJson: unknown;
  now?: Date;
}): HouseholdBenchmarkBreakdown {
  const now = args.now ?? new Date();
  const byCategory: HouseholdBenchmarkBreakdown["byCategory"] = [];
  let grossRewardsUsd = 0;

  for (const [cat, spendUsd] of Object.entries(BLS_INSPIRED_MONTHLY_SPEND_MIX) as [
    SpendCategory,
    number,
  ][]) {
    if (spendUsd <= 0) continue;
    const detail = scoreCardForCategory(
      args.card,
      spendUsd,
      cat,
      now,
      0,
    );
    grossRewardsUsd += detail.comparableValue;
    byCategory.push({
      category: cat,
      spendUsd,
      rewardUsd: Math.round(detail.comparableValue * 100) / 100,
    });
  }

  const statementCreditsAnnual = parseStatementCreditsAnnualUsd(
    args.catalogExtractJson,
  );
  const statementCreditsUsd =
    Math.round((statementCreditsAnnual / 12) * 100) / 100;
  const annualFeeUsd = parseAnnualFeeDollarsFromExtract(args.catalogExtractJson);
  const feeMonthly = Math.round((annualFeeUsd / 12) * 100) / 100;
  const netValueUsd =
    Math.round(
      (grossRewardsUsd + statementCreditsUsd - feeMonthly) * 100,
    ) / 100;

  return {
    grossRewardsUsd: Math.round(grossRewardsUsd * 100) / 100,
    statementCreditsUsd,
    annualFeeUsd,
    netValueUsd,
    scoreOutOf100: netValueToScoreOutOf100(netValueUsd),
    spendProfileLabel: `BLS-inspired mix · $${HOUSEHOLD_BENCHMARK_SPEND_USD}/mo`,
    byCategory,
  };
}
