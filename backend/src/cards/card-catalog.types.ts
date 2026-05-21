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
  imageUrl?: string;
  officialDocumentUrl?: string;
  /** Legacy UI templates — empty here; curated snapshots live in the DB intel pipeline. */
  rules: CardCatalogRule[];
};
