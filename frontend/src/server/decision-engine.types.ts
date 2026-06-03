import { EarningType, OfferStackPolicy, SpendCategory } from '@prisma/client';

export type EngineOffer = {
  category: SpendCategory | null;
  multiplier: number;
  stackPolicy: OfferStackPolicy;
  validFrom: Date;
  validUntil: Date;
  title: string;
  /** When set (e.g. curated rotating 5% cashback), overrides the base rule's earning type for this offer */
  earningTypeOverride?: EarningType;
};

export type EngineRule = {
  category: SpendCategory;
  multiplier: number;
  earningType: EarningType;
  capAmountMonthly: number | null;
  priority: number;
  excludedMerchants?: string[];
};

export type EngineCard = {
  id: string;
  name: string;
  issuer: string;
  rules: EngineRule[];
  offers: EngineOffer[];
};

export type DecisionEngineInput = {
  /** Defaults to REFERENCE_PURCHASE_USD — ranking is %-based. */
  amount?: number;
  resolvedCategory: SpendCategory;
  cards: EngineCard[];
  /** Merchant name for exclusion-aware category rule selection. */
  merchantName?: string | null;
  /** Optional: amount already counted toward monthly cap for this card+category */
  categorySpendUsedMonthByCard?: Record<string, number>;
  now?: Date;
};

export type CardScoreDetail = {
  cardId: string;
  cardName: string;
  issuer: string;
  baseMultiplier: number;
  effectiveMultiplier: number;
  earningType: EarningType;
  comparableValue: number;
  explanationLines: string[];
  merchantExcluded?: boolean;
};

export type DecisionEngineResult = {
  bestCardId: string | null;
  bestComparableValue: number;
  resolvedCategory: SpendCategory;
  winner?: CardScoreDetail;
  ranked: CardScoreDetail[];
  alternatesTied: string[];
};
