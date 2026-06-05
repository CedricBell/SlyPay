import type { CardSpendBenefits } from "@/lib/recommendation-benefits";

export type RecRes = {
  recommendationId: string | null;
  evaluationDate?: string;
  resolvedCategory: string;
  categoryResolution: { trace: string[] };
  bestCard: {
    name: string;
    issuer: string;
    last4: string | null;
    colorHex?: string | null;
    catalogImageUrl?: string | null;
  } | null;
  reasoning: string[];
  bestCardBenefits?: CardSpendBenefits | null;
  ranked: Array<{
    cardId: string;
    cardName: string;
    issuer: string;
    effectiveMultiplier: number;
    earningType: string;
    rateLabel: string;
  last4?: string | null;
  colorHex?: string | null;
  catalogImageUrl?: string | null;
    benefits: CardSpendBenefits;
    explanationLines: string[];
    catalogRotatingQuarters?: Array<{
      validFrom: string;
      validUntil: string;
      categories: string[];
      multiplier: number;
      label: string;
      details?: string;
    }> | null;
  }>;
  alternatesTied: string[];
  marketBest: {
    cardId: string;
    cardName: string;
    issuer: string;
    effectiveMultiplier: number;
    earningType: string;
    rateLabel: string;
    benefits: CardSpendBenefits | null;
  } | null;
};

export type CardRow = {
  id: string;
  name: string;
  issuer: string;
  last4: string | null;
  colorHex: string | null;
  isActive: boolean;
};
