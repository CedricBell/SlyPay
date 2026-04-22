import { EarningType, SpendCategory } from '@prisma/client';
import { CardCatalogEntry } from './card-catalog.types';

/**
 * Curated templates for autocomplete (US-focused, illustrative rates).
 * Not affiliated with issuers — encourage users to adjust rules to their product.
 */
export const CARD_CATALOG_ENTRIES: CardCatalogEntry[] = [
  {
    id: 'chase-sapphire-preferred',
    name: 'Sapphire Preferred',
    issuer: 'Chase',
    colorHex: '#0f172a',
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 2, earningType: EarningType.POINTS },
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'chase-sapphire-reserve',
    name: 'Sapphire Reserve',
    issuer: 'Chase',
    colorHex: '#14532d',
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'chase-freedom-unlimited',
    name: 'Freedom Unlimited',
    issuer: 'Chase',
    colorHex: '#1e3a5f',
    rules: [
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.DRUGSTORES, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.TRAVEL, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1.5, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'chase-freedom-flex',
    name: 'Freedom Flex',
    issuer: 'Chase',
    colorHex: '#0d9488',
    rules: [
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.DRUGSTORES, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.TRAVEL, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'amex-gold',
    name: 'American Express Gold Card',
    issuer: 'American Express',
    colorHex: '#b45309',
    rules: [
      { category: SpendCategory.DINING, multiplier: 4, earningType: EarningType.POINTS },
      { category: SpendCategory.GROCERIES, multiplier: 4, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'amex-platinum',
    name: 'American Express Platinum Card',
    issuer: 'American Express',
    colorHex: '#a1a1aa',
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 5, earningType: EarningType.POINTS },
      { category: SpendCategory.DINING, multiplier: 1, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'amex-blue-cash-preferred',
    name: 'Blue Cash Preferred',
    issuer: 'American Express',
    colorHex: '#006fcf',
    rules: [
      { category: SpendCategory.GROCERIES, multiplier: 6, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.GAS, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'citi-double-cash',
    name: 'Double Cash',
    issuer: 'Citi',
    colorHex: '#003b70',
    rules: [
      { category: SpendCategory.GAS, multiplier: 2, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.DRUGSTORES, multiplier: 2, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 2, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'citi-custom-cash',
    name: 'Custom Cash',
    issuer: 'Citi',
    colorHex: '#0ea5e9',
    rules: [
      { category: SpendCategory.GROCERIES, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.GAS, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.DINING, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.TRAVEL, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'capital-one-venture',
    name: 'Venture',
    issuer: 'Capital One',
    colorHex: '#1a1a1a',
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 5, earningType: EarningType.MILES },
      { category: SpendCategory.OTHER, multiplier: 2, earningType: EarningType.MILES },
    ],
  },
  {
    id: 'capital-one-savor',
    name: 'Savor',
    issuer: 'Capital One',
    colorHex: '#7c3aed',
    rules: [
      { category: SpendCategory.DINING, multiplier: 4, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.ENTERTAINMENT, multiplier: 4, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.GROCERIES, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'discover-it',
    name: 'Discover it',
    issuer: 'Discover',
    colorHex: '#f97316',
    rules: [
      { category: SpendCategory.GROCERIES, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.GAS, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.DINING, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.TRAVEL, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'wells-fargo-active-cash',
    name: 'Active Cash',
    issuer: 'Wells Fargo',
    colorHex: '#d97706',
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.ONLINE_SHOPPING, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 2, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'boa-customized-cash',
    name: 'Customized Cash Rewards',
    issuer: 'Bank of America',
    colorHex: '#e11d48',
    rules: [
      { category: SpendCategory.ONLINE_SHOPPING, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.GAS, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.DRUGSTORES, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'usbank-altitude-go',
    name: 'Altitude Go',
    issuer: 'U.S. Bank',
    colorHex: '#0369a1',
    rules: [
      { category: SpendCategory.DINING, multiplier: 4, earningType: EarningType.POINTS },
      { category: SpendCategory.GROCERIES, multiplier: 2, earningType: EarningType.POINTS },
      { category: SpendCategory.GAS, multiplier: 2, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
];
