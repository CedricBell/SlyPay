import { EarningType, OfferStackPolicy, SpendCategory } from '@prisma/client';

export type EngineOffer = {
  category: SpendCategory | null;
  multiplier: number;
  stackPolicy: OfferStackPolicy;
  validFrom: Date;
  validUntil: Date;
  title: string;
};

export type EngineRule = {
  category: SpendCategory;
  multiplier: number;
  earningType: EarningType;
  capAmountMonthly: number | null;
  priority: number;
};

export type EngineCard = {
  id: string;
  name: string;
  issuer: string;
  rules: EngineRule[];
  offers: EngineOffer[];
};

export type DecisionEngineInput = {
  amount: number;
  resolvedCategory: SpendCategory;
  cards: EngineCard[];
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
};

export type DecisionEngineResult = {
  bestCardId: string | null;
  bestComparableValue: number;
  resolvedCategory: SpendCategory;
  winner?: CardScoreDetail;
  ranked: CardScoreDetail[];
  alternatesTied: string[];
};
