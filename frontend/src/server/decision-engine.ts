import { EarningType, OfferStackPolicy, SpendCategory } from '@prisma/client';
import {
  formatMerchantExclusionNote,
  isMerchantExcluded,
} from '@/server/merchant-exclusions';
import {
  CardScoreDetail,
  DecisionEngineInput,
  DecisionEngineResult,
  EngineCard,
  EngineOffer,
  EngineRule,
} from './decision-engine.types';

const DEFAULT_MULTIPLIER = 1;
const POINT_VALUE_USD = 0.0125;
const MILE_VALUE_USD = 0.012;

function toNumber(n: unknown): number {
  if (typeof n === 'number') return n;
  if (n && typeof (n as { toNumber?: () => number }).toNumber === 'function') {
    return (n as { toNumber: () => number }).toNumber();
  }
  return Number(n);
}

/** Reference purchase size for ranking — rewards scale linearly so winner is amount-invariant (except caps). */
export const REFERENCE_PURCHASE_USD = 100;
export function comparableRewardValue(
  amount: number,
  multiplier: number,
  earningType: EarningType,
): number {
  if (earningType === EarningType.CASHBACK_PERCENT) {
    return amount * (multiplier / 100);
  }
  if (earningType === EarningType.POINTS) {
    return amount * multiplier * POINT_VALUE_USD;
  }
  return amount * multiplier * MILE_VALUE_USD;
}

function pickRuleForCategory(
  rules: EngineRule[],
  category: SpendCategory,
  merchantName?: string | null,
): { rule: EngineRule | undefined; merchantExcluded: boolean } {
  const exact = rules.filter((r) => r.category === category);
  if (exact.length === 0) {
    const other = rules.filter((r) => r.category === SpendCategory.OTHER);
    if (other.length === 0) return { rule: undefined, merchantExcluded: false };
    return {
      rule: other.sort((a, b) => b.priority - a.priority)[0],
      merchantExcluded: false,
    };
  }

  const sorted = exact.sort((a, b) => b.priority - a.priority);
  for (const candidate of sorted) {
    if (
      merchantName &&
      isMerchantExcluded(merchantName, candidate.excludedMerchants)
    ) {
      continue;
    }
    return { rule: candidate, merchantExcluded: false };
  }

  const top = sorted[0];
  if (
    top &&
    merchantName &&
    isMerchantExcluded(merchantName, top.excludedMerchants)
  ) {
    const other = rules
      .filter((r) => r.category === SpendCategory.OTHER)
      .sort((a, b) => b.priority - a.priority)[0];
    return { rule: other ?? top, merchantExcluded: true };
  }

  return { rule: top, merchantExcluded: false };
}

function activeOffersForCategory(
  offers: EngineOffer[],
  category: SpendCategory,
  now: Date,
): EngineOffer[] {
  return offers.filter((o) => {
    if (o.validFrom > now || o.validUntil < now) return false;
    if (o.category === null || o.category === category) return true;
    return false;
  });
}

function applyOffersToMultiplier(
  baseMult: number,
  baseType: EarningType,
  offers: EngineOffer[],
  category: SpendCategory,
  now: Date,
  lines: string[],
): { mult: number; type: EarningType } {
  const active = activeOffersForCategory(offers, category, now);
  if (active.length === 0) {
    return { mult: baseMult, type: baseType };
  }

  let best = { mult: baseMult, type: baseType, label: '' as string };

  for (const o of active) {
    if (o.stackPolicy === OfferStackPolicy.REPLACE_BASE) {
      const effType = o.earningTypeOverride ?? baseType;
      const candidate = { mult: o.multiplier, type: effType, label: o.title };
      if (
        comparableRewardValue(1, candidate.mult, candidate.type) >
        comparableRewardValue(1, best.mult, best.type)
      ) {
        best = candidate;
      }
    } else {
      const effType = o.earningTypeOverride ?? baseType;
      const combined = baseMult + o.multiplier;
      const candidate = { mult: combined, type: effType, label: o.title };
      if (
        comparableRewardValue(1, candidate.mult, candidate.type) >
        comparableRewardValue(1, best.mult, best.type)
      ) {
        best = candidate;
      }
    }
  }

  if (best.label) {
    const policy = active.find((x) => x.title === best.label)?.stackPolicy;
    lines.push(
      policy === OfferStackPolicy.ADDITIVE
        ? `Active promo "${best.label}" stacks on base (${baseMult}x → ${best.mult}x).`
        : `Active promo "${best.label}" replaces base rate (${baseMult}x → ${best.mult}x).`,
    );
  }

  return { mult: best.mult, type: best.type };
}

/** Score one purchase slice (used by recommendation + household benchmark). */
export function scoreCardForCategory(
  card: EngineCard,
  amount: number,
  category: SpendCategory,
  now: Date,
  usedMonth: number,
  merchantName?: string | null,
): CardScoreDetail {
  const lines: string[] = [];
  const { rule, merchantExcluded } = pickRuleForCategory(
    card.rules,
    category,
    merchantName,
  );
  const baseMult = rule ? toNumber(rule.multiplier) : DEFAULT_MULTIPLIER;
  const earningType = rule?.earningType ?? EarningType.POINTS;

  if (merchantExcluded && merchantName) {
    lines.push(
      formatMerchantExclusionNote(
        merchantName,
        category.replace(/_/g, ' ').toLowerCase(),
      ),
    );
  }

  if (!rule) {
    lines.push(
      `No rule for ${category}; using ${DEFAULT_MULTIPLIER}x ${earningType} (default).`,
    );
  } else if (!merchantExcluded) {
    lines.push(
      `Base rule: ${category} at ${baseMult}x (${earningType.replace(/_/g, ' ').toLowerCase()}).`,
    );
    if (rule.excludedMerchants?.length) {
      lines.push(
        `Excludes: ${rule.excludedMerchants.slice(0, 4).join(', ')}${rule.excludedMerchants.length > 4 ? '…' : ''}.`,
      );
    }
  } else {
    lines.push(
      `Fallback rule: ${rule.category} at ${baseMult}x (${earningType.replace(/_/g, ' ').toLowerCase()}).`,
    );
  }

  let effectiveMult = baseMult;
  let effectiveType = earningType;

  const { mult, type } = applyOffersToMultiplier(
    baseMult,
    earningType,
    card.offers,
    merchantExcluded ? SpendCategory.OTHER : category,
    now,
    lines,
  );
  effectiveMult = mult;
  effectiveType = type;

  if (rule?.capAmountMonthly != null) {
    const cap = toNumber(rule.capAmountMonthly);
    const remaining = Math.max(0, cap - usedMonth);
    if (amount > remaining && remaining >= 0) {
      const ratio = cap === 0 ? 0 : remaining / amount;
      const uncappedValue = comparableRewardValue(
        amount,
        effectiveMult,
        effectiveType,
      );
      const cappedValue = uncappedValue * Math.min(1, ratio);
      lines.push(
        `Monthly cap: $${cap.toFixed(0)} on this category (${remaining.toFixed(0)} remaining this month).`,
      );
      return {
        cardId: card.id,
        cardName: card.name,
        issuer: card.issuer,
        baseMultiplier: baseMult,
        effectiveMultiplier: effectiveMult,
        earningType: effectiveType,
        comparableValue: cappedValue,
        explanationLines: lines,
        merchantExcluded,
      };
    }
  }

  const comparableValue = comparableRewardValue(
    amount,
    effectiveMult,
    effectiveType,
  );

  return {
    cardId: card.id,
    cardName: card.name,
    issuer: card.issuer,
    baseMultiplier: baseMult,
    effectiveMultiplier: effectiveMult,
    earningType: effectiveType,
    comparableValue,
    explanationLines: lines,
    merchantExcluded,
  };
}

export function decideBestCard(input: DecisionEngineInput): DecisionEngineResult {
  const now = input.now ?? new Date();
  const usedMap = input.categorySpendUsedMonthByCard ?? {};
  const merchantName = input.merchantName?.trim() || null;

  if (!input.cards.length) {
    return {
      bestCardId: null,
      bestComparableValue: 0,
      resolvedCategory: input.resolvedCategory,
      ranked: [],
      alternatesTied: [],
    };
  }

  const referenceAmount = input.amount ?? REFERENCE_PURCHASE_USD;

  const ranked = input.cards.map((c) =>
    scoreCardForCategory(
      c,
      referenceAmount,
      input.resolvedCategory,
      now,
      usedMap[c.id] ?? 0,
      merchantName,
    ),
  );

  ranked.sort((a, b) => {
    if (b.comparableValue !== a.comparableValue) {
      return b.comparableValue - a.comparableValue;
    }
    return a.cardId.localeCompare(b.cardId);
  });

  const top = ranked[0];
  const bestVal = top?.comparableValue ?? 0;
  const alternatesTied = ranked
    .filter((r) => r.comparableValue === bestVal && r.cardId !== top?.cardId)
    .map((r) => r.cardId);

  return {
    bestCardId: top?.cardId ?? null,
    bestComparableValue: bestVal,
    resolvedCategory: input.resolvedCategory,
    winner: top,
    ranked,
    alternatesTied,
  };
}
