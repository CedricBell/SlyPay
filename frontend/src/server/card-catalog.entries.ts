import { EarningType, SpendCategory } from '@prisma/client';
import { CardCatalogEntry } from './card-catalog.types';

/**
 * Curated templates for autocomplete (US-focused, illustrative rates).
 * Not affiliated with issuers — encourage users to adjust rules to their product.
 */
function cardImage(label: string): string {
  return `https://placehold.co/320x200/111827/F9FAFB/png?text=${encodeURIComponent(label)}`;
}

export const CARD_CATALOG_ENTRIES: CardCatalogEntry[] = [
  {
    id: 'chase-sapphire-preferred',
    name: 'Sapphire Preferred',
    issuer: 'Chase',
    colorHex: '#0f172a',
    imageUrl: cardImage('Chase Sapphire Preferred'),
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
    imageUrl: cardImage('Chase Sapphire Reserve'),
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
    imageUrl: cardImage('Chase Freedom Unlimited'),
    rules: [
      { category: SpendCategory.OTHER, multiplier: 1.5, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'chase-freedom-flex',
    name: 'Freedom Flex',
    issuer: 'Chase',
    colorHex: '#0d9488',
    imageUrl: cardImage('Chase Freedom Flex'),
    rules: [
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'chase-amazon-prime-visa',
    name: 'Prime Visa',
    issuer: 'Chase',
    colorHex: '#0a5a9c',
    imageUrl: cardImage('Prime Visa'),
    rules: [
      { category: SpendCategory.ONLINE_SHOPPING, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.GAS, multiplier: 2, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.DINING, multiplier: 2, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'amex-gold',
    name: 'American Express Gold Card',
    issuer: 'American Express',
    colorHex: '#b45309',
    imageUrl: cardImage('Amex Gold'),
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
    imageUrl: cardImage('Amex Platinum'),
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 5, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'amex-blue-cash-preferred',
    name: 'Blue Cash Preferred',
    issuer: 'American Express',
    colorHex: '#006fcf',
    imageUrl: cardImage('Amex Blue Cash Preferred'),
    rules: [
      { category: SpendCategory.GROCERIES, multiplier: 6, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.GAS, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'amex-blue-cash-everyday',
    name: 'Blue Cash Everyday',
    issuer: 'American Express',
    colorHex: '#2563eb',
    imageUrl: cardImage('Amex Blue Cash Everyday'),
    rules: [
      { category: SpendCategory.GROCERIES, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.ONLINE_SHOPPING, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.GAS, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'amex-green',
    name: 'American Express Green Card',
    issuer: 'American Express',
    colorHex: '#166534',
    imageUrl: cardImage('Amex Green'),
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'citi-double-cash',
    name: 'Double Cash',
    issuer: 'Citi',
    colorHex: '#003b70',
    imageUrl: cardImage('Citi Double Cash'),
    rules: [
      { category: SpendCategory.OTHER, multiplier: 2, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'citi-custom-cash',
    name: 'Custom Cash',
    issuer: 'Citi',
    colorHex: '#0ea5e9',
    imageUrl: cardImage('Citi Custom Cash'),
    rules: [
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'citi-premier',
    name: 'Strata Premier',
    issuer: 'Citi',
    colorHex: '#1d4ed8',
    imageUrl: cardImage('Citi Strata Premier'),
    rules: [
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.GAS, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.GROCERIES, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.TRAVEL, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'capital-one-venture',
    name: 'Venture',
    issuer: 'Capital One',
    colorHex: '#1a1a1a',
    imageUrl: cardImage('Capital One Venture'),
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 2, earningType: EarningType.MILES },
      { category: SpendCategory.OTHER, multiplier: 2, earningType: EarningType.MILES },
    ],
  },
  {
    id: 'capital-one-venture-x',
    name: 'Venture X',
    issuer: 'Capital One',
    colorHex: '#111827',
    imageUrl: cardImage('Capital One Venture X'),
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 2, earningType: EarningType.MILES },
      { category: SpendCategory.OTHER, multiplier: 2, earningType: EarningType.MILES },
    ],
  },
  {
    id: 'capital-one-quicksilver',
    name: 'Quicksilver',
    issuer: 'Capital One',
    colorHex: '#334155',
    imageUrl: cardImage('Capital One Quicksilver'),
    rules: [{ category: SpendCategory.OTHER, multiplier: 1.5, earningType: EarningType.CASHBACK_PERCENT }],
  },
  {
    id: 'capital-one-savor',
    name: 'Savor',
    issuer: 'Capital One',
    colorHex: '#7c3aed',
    imageUrl: cardImage('Capital One Savor'),
    rules: [
      { category: SpendCategory.DINING, multiplier: 4, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.ENTERTAINMENT, multiplier: 4, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'capital-one-savorone',
    name: 'SavorOne',
    issuer: 'Capital One',
    colorHex: '#6d28d9',
    imageUrl: cardImage('Capital One SavorOne'),
    rules: [
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.ENTERTAINMENT, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.GROCERIES, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'discover-it',
    name: 'Discover it',
    issuer: 'Discover',
    colorHex: '#f97316',
    imageUrl: cardImage('Discover it'),
    rules: [
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'discover-it-miles',
    name: 'Discover it Miles',
    issuer: 'Discover',
    colorHex: '#ea580c',
    imageUrl: cardImage('Discover it Miles'),
    rules: [{ category: SpendCategory.OTHER, multiplier: 1.5, earningType: EarningType.MILES }],
  },
  {
    id: 'wells-fargo-active-cash',
    name: 'Active Cash',
    issuer: 'Wells Fargo',
    colorHex: '#d97706',
    imageUrl: cardImage('Wells Fargo Active Cash'),
    rules: [
      { category: SpendCategory.OTHER, multiplier: 2, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'wells-fargo-autograph',
    name: 'Autograph',
    issuer: 'Wells Fargo',
    colorHex: '#b45309',
    imageUrl: cardImage('Wells Fargo Autograph'),
    rules: [
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.TRAVEL, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.GAS, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'boa-customized-cash',
    name: 'Customized Cash Rewards',
    issuer: 'Bank of America',
    colorHex: '#e11d48',
    imageUrl: cardImage('BofA Customized Cash'),
    rules: [
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'boa-unlimited-cash',
    name: 'Unlimited Cash Rewards',
    issuer: 'Bank of America',
    colorHex: '#be123c',
    imageUrl: cardImage('BofA Unlimited Cash'),
    rules: [{ category: SpendCategory.OTHER, multiplier: 1.5, earningType: EarningType.CASHBACK_PERCENT }],
  },
  {
    id: 'usbank-altitude-go',
    name: 'Altitude Go',
    issuer: 'U.S. Bank',
    colorHex: '#0369a1',
    imageUrl: cardImage('US Bank Altitude Go'),
    rules: [
      { category: SpendCategory.DINING, multiplier: 4, earningType: EarningType.POINTS },
      { category: SpendCategory.GROCERIES, multiplier: 2, earningType: EarningType.POINTS },
      { category: SpendCategory.GAS, multiplier: 2, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'usbank-cash-plus',
    name: 'Cash+ Visa Signature',
    issuer: 'U.S. Bank',
    colorHex: '#075985',
    imageUrl: cardImage('US Bank Cash Plus'),
    rules: [
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'barclays-arrival-plus',
    name: 'Arrival Plus',
    issuer: 'Barclays',
    colorHex: '#1e40af',
    imageUrl: cardImage('Barclays Arrival Plus'),
    rules: [
      { category: SpendCategory.TRAVEL, multiplier: 2, earningType: EarningType.MILES },
      { category: SpendCategory.OTHER, multiplier: 2, earningType: EarningType.MILES },
    ],
  },
  {
    id: 'apple-card',
    name: 'Apple Card',
    issuer: 'Goldman Sachs',
    colorHex: '#e5e7eb',
    imageUrl: cardImage('Apple Card'),
    rules: [
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'paypal-cashback-mastercard',
    name: 'PayPal Cashback Mastercard',
    issuer: 'Synchrony',
    colorHex: '#0f4da2',
    imageUrl: cardImage('PayPal Cashback Mastercard'),
    rules: [{ category: SpendCategory.OTHER, multiplier: 2, earningType: EarningType.CASHBACK_PERCENT }],
  },
  {
    id: 'bilt-mastercard',
    name: 'Bilt Mastercard',
    issuer: 'Wells Fargo',
    colorHex: '#1f2937',
    imageUrl: cardImage('Bilt Mastercard'),
    rules: [
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.POINTS },
      { category: SpendCategory.TRAVEL, multiplier: 2, earningType: EarningType.POINTS },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.POINTS },
    ],
  },
  {
    id: 'costco-anywhere',
    name: 'Costco Anywhere Visa',
    issuer: 'Citi',
    colorHex: '#1d4ed8',
    imageUrl: cardImage('Costco Anywhere Visa'),
    rules: [
      { category: SpendCategory.GAS, multiplier: 4, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.TRAVEL, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.DINING, multiplier: 3, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
  {
    id: 'amazon-store-card',
    name: 'Amazon Store Card',
    issuer: 'Synchrony',
    colorHex: '#0f172a',
    imageUrl: cardImage('Amazon Store Card'),
    rules: [
      { category: SpendCategory.ONLINE_SHOPPING, multiplier: 5, earningType: EarningType.CASHBACK_PERCENT },
      { category: SpendCategory.OTHER, multiplier: 1, earningType: EarningType.CASHBACK_PERCENT },
    ],
  },
];
