import { EarningType, SpendCategory } from "@prisma/client";
import {
  BLS_INSPIRED_MONTHLY_SPEND_MIX,
  toEngineCardFromWallet,
} from "@/lib/household-benchmark-score";
import { rewardRulesForWalletCard } from "@/lib/credit-card-rules";
import type { CreditCard, Offer, RewardRule } from "@prisma/client";
import { scoreCardForCategory } from "@/server/decision-engine";
import type { EngineCard } from "@/server/decision-engine.types";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { rotatingCalendarToEngineOffers } from "@/server/rotating-bonus-calendar";

const REFERENCE_SPEND_USD = 100;

export type CategoryOptimization = {
  category: SpendCategory;
  scorePercent: number;
  walletBestLabel: string;
  marketBestLabel: string;
  walletCardName: string | null;
  marketCardName: string | null;
};

export type WalletOptimizationScore = {
  overallPercent: number;
  hasCards: boolean;
  categories: CategoryOptimization[];
};

function formatRateLabel(multiplier: number, earningType: EarningType): string {
  if (earningType === EarningType.CASHBACK_PERCENT) {
    return `${multiplier}% cashback`;
  }
  if (earningType === EarningType.POINTS) {
    return `${multiplier}× points`;
  }
  return `${multiplier}× miles`;
}

function buildCatalogEngineCards(): EngineCard[] {
  return CARD_CATALOG_ENTRIES.map((c) => ({
    id: `catalog:${c.id}`,
    name: c.name,
    issuer: c.issuer,
    rules: c.rules.map((r) => ({
      category: r.category,
      multiplier: r.multiplier,
      earningType: r.earningType,
      capAmountMonthly: null,
      priority: 0,
    })),
    offers: rotatingCalendarToEngineOffers(c.rotatingBonusCalendar ?? null),
  }));
}

function bestInCategory(
  cards: EngineCard[],
  category: SpendCategory,
  now: Date,
): {
  comparableValue: number;
  effectiveMultiplier: number;
  earningType: EarningType;
  cardName: string;
} | null {
  if (cards.length === 0) return null;

  let best: {
    comparableValue: number;
    effectiveMultiplier: number;
    earningType: EarningType;
    cardName: string;
  } | null = null;

  for (const card of cards) {
    const detail = scoreCardForCategory(
      card,
      REFERENCE_SPEND_USD,
      category,
      now,
      0,
    );
    if (
      !best ||
      detail.comparableValue > best.comparableValue + 1e-9
    ) {
      best = {
        comparableValue: detail.comparableValue,
        effectiveMultiplier: detail.effectiveMultiplier,
        earningType: detail.earningType,
        cardName: detail.cardName,
      };
    }
  }

  return best;
}

export type WalletOptimizationInput = CreditCard & {
  offers: Offer[];
  catalogProduct?: {
    rewardRules?: RewardRule[];
    rotatingBonusCalendar: unknown;
  } | null;
};

export function computeWalletOptimizationScore(
  dbCards: WalletOptimizationInput[],
  now: Date = new Date(),
): WalletOptimizationScore {
  const active = dbCards.filter((c) => c.isActive);
  if (active.length === 0) {
    return { overallPercent: 0, hasCards: false, categories: [] };
  }

  const walletEngineCards: EngineCard[] = active.map((c) =>
    toEngineCardFromWallet({
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      rules: rewardRulesForWalletCard(c),
      offers: c.offers,
      rotatingBonusCalendar:
        c.catalogProduct?.rotatingBonusCalendar ??
        CARD_CATALOG_ENTRIES.find((e) => e.id === c.catalogProductSlug)
          ?.rotatingBonusCalendar ??
        null,
    }),
  );

  const marketEngineCards = buildCatalogEngineCards();
  const categories: CategoryOptimization[] = [];
  let weightedWallet = 0;
  let weightedMarket = 0;

  for (const [cat, weight] of Object.entries(
    BLS_INSPIRED_MONTHLY_SPEND_MIX,
  ) as [SpendCategory, number][]) {
    if (weight <= 0) continue;

    const walletBest = bestInCategory(walletEngineCards, cat, now);
    const marketBest = bestInCategory(marketEngineCards, cat, now);
    if (!walletBest || !marketBest || marketBest.comparableValue <= 0) {
      continue;
    }

    const scorePercent = Math.min(
      100,
      Math.round(
        (walletBest.comparableValue / marketBest.comparableValue) * 100,
      ),
    );

    categories.push({
      category: cat,
      scorePercent,
      walletBestLabel: formatRateLabel(
        walletBest.effectiveMultiplier,
        walletBest.earningType,
      ),
      marketBestLabel: formatRateLabel(
        marketBest.effectiveMultiplier,
        marketBest.earningType,
      ),
      walletCardName: walletBest.cardName,
      marketCardName: marketBest.cardName,
    });

    weightedWallet += walletBest.comparableValue * weight;
    weightedMarket += marketBest.comparableValue * weight;
  }

  const overallPercent =
    weightedMarket > 0
      ? Math.min(100, Math.round((weightedWallet / weightedMarket) * 100))
      : 0;

  return {
    overallPercent,
    hasCards: true,
    categories: categories.sort((a, b) => a.scorePercent - b.scorePercent),
  };
}
