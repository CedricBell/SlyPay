import { EarningType, SpendCategory } from '@prisma/client';

export type CardCatalogRule = {
  category: SpendCategory;
  multiplier: number;
  earningType: EarningType;
};

export type CardCatalogEntry = {
  id: string;
  name: string;
  issuer: string;
  colorHex?: string;
  /** Approximate public earn structure — users should verify with their issuer */
  rules: CardCatalogRule[];
};
