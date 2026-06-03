import type { CardCatalogEntry } from "./card-catalog.types";
import { ROTATING_CALENDARS_BY_SLUG } from "@/server/rotating-calendars.data";

/**
 * Catalog identities for autocomplete + `CardCatalogProduct.slug`.
 * Reward specifics come from the intelligence pipeline (`officialDocumentUrl` when set).
 */
function cardImage(label: string): string {
  return `https://placehold.co/320x200/111827/F9FAFB/png?text=${encodeURIComponent(label)}`;
}

/**
 * Curated issuer-hosted card art (official marketing assets).
 * Falls back to placeholder when not listed.
 */
const CURATED_IMAGE_URLS: Record<string, string> = {
  "chase-sapphire-preferred":
    "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-sapphire-preferred/card-sapphire-preferred.png",
  "chase-sapphire-reserve":
    "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-sapphire-reserve/card-sapphire-reserve.png",
  "chase-freedom-unlimited":
    "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-freedom-unlimited/card-freedom-unlimited.png",
  "chase-freedom-flex":
    "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-freedom-flex/card-freedom-flex.png",
  "amex-gold":
    "https://www.americanexpress.com/content/dam/amex/us/en/credit-cards/card-art/consumer/gold-card/gold-card-480x304.png",
  "amex-platinum":
    "https://www.americanexpress.com/content/dam/amex/us/en/credit-cards/card-art/consumer/platinum-card/platinum-card-480x304.png",
  "amex-blue-cash-preferred":
    "https://www.americanexpress.com/content/dam/amex/us/en/credit-cards/card-art/consumer/blue-cash-preferred/blue-cash-preferred-480x304.png",
  "amex-blue-cash-everyday":
    "https://www.americanexpress.com/content/dam/amex/us/en/credit-cards/card-art/consumer/blue-cash-everyday/blue-cash-everyday-480x304.png",
  "amex-green":
    "https://www.americanexpress.com/content/dam/amex/us/en/credit-cards/card-art/consumer/green-card/green-card-480x304.png",
  "citi-double-cash":
    "https://www.citi.com/CRD/images/card_art/citi-double-cash-card.png",
  "capital-one-venture-x":
    "https://ecm.capitalone.com/WCM/card/products/venture-x-card-art.png",
  "discover-it":
    "https://www.discover.com/content/dam/discover/en_us/credit-cards/card-art/discover-it-cash-back.png",
  "apple-card":
    "https://www.apple.com/v/apple-card/d/images/overview/apple_card__c8uwy0f3xoyq_large.png",
  "bilt-mastercard":
    "https://www.biltrewards.com/assets/images/card/bilt-card-front.png",
};

/** Preferred intel source pages (product / offer details — not travel hubs). */
const CURATED_OFFICIAL_URLS: Record<string, string> = {
  "chase-sapphire-preferred":
    "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
  "chase-sapphire-reserve":
    "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve",
  "chase-freedom-unlimited":
    "https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited",
  "chase-freedom-flex":
    "https://creditcards.chase.com/cash-back-credit-cards/freedom/flex",
  "amex-gold": "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
  "amex-platinum":
    "https://www.americanexpress.com/us/credit-cards/card/platinum-card/",
  "amex-blue-cash-preferred":
    "https://www.americanexpress.com/us/credit-cards/card/blue-cash-preferred/",
  "amex-blue-cash-everyday":
    "https://www.americanexpress.com/us/credit-cards/card/blue-cash-everyday/",
  "amex-green": "https://www.americanexpress.com/us/credit-cards/card/green-card/",
  "citi-double-cash": "https://www.citi.com/credit-cards/citi-double-cash-credit-card",
  "discover-it": "https://www.discover.com/credit-cards/cash-back/it-card.html",
  "capital-one-venture-x":
    "https://www.capitalone.com/credit-cards/venture-x/",
};

type Raw = Pick<
  CardCatalogEntry,
  "id" | "name" | "issuer" | "colorHex" | "officialDocumentUrl" | "imageUrl"
> & { imageLabel: string };

const RAW: Raw[] = [
  {
    id: "chase-sapphire-preferred",
    name: "Sapphire Preferred",
    issuer: "Chase",
    colorHex: "#0f172a",
    imageLabel: "Chase Sapphire Preferred",
  },
  {
    id: "chase-sapphire-reserve",
    name: "Sapphire Reserve",
    issuer: "Chase",
    colorHex: "#14532d",
    imageLabel: "Chase Sapphire Reserve",
  },
  {
    id: "chase-freedom-unlimited",
    name: "Freedom Unlimited",
    issuer: "Chase",
    colorHex: "#1e3a5f",
    imageLabel: "Chase Freedom Unlimited",
  },
  {
    id: "chase-freedom-flex",
    name: "Freedom Flex",
    issuer: "Chase",
    colorHex: "#0d9488",
    imageLabel: "Chase Freedom Flex",
  },
  {
    id: "chase-amazon-prime-visa",
    name: "Prime Visa",
    issuer: "Chase",
    colorHex: "#0a5a9c",
    imageLabel: "Prime Visa",
  },
  {
    id: "amex-gold",
    name: "American Express Gold Card",
    issuer: "American Express",
    colorHex: "#b45309",
    imageLabel: "Amex Gold",
  },
  {
    id: "amex-platinum",
    name: "American Express Platinum Card",
    issuer: "American Express",
    colorHex: "#a1a1aa",
    imageLabel: "Amex Platinum",
  },
  {
    id: "amex-blue-cash-preferred",
    name: "Blue Cash Preferred",
    issuer: "American Express",
    colorHex: "#006fcf",
    imageLabel: "Amex Blue Cash Preferred",
  },
  {
    id: "amex-blue-cash-everyday",
    name: "Blue Cash Everyday",
    issuer: "American Express",
    colorHex: "#2563eb",
    imageLabel: "Amex Blue Cash Everyday",
  },
  {
    id: "amex-green",
    name: "American Express Green Card",
    issuer: "American Express",
    colorHex: "#166534",
    imageLabel: "Amex Green",
  },
  {
    id: "citi-double-cash",
    name: "Double Cash",
    issuer: "Citi",
    colorHex: "#003b70",
    imageLabel: "Citi Double Cash",
  },
  {
    id: "citi-custom-cash",
    name: "Custom Cash",
    issuer: "Citi",
    colorHex: "#0ea5e9",
    imageLabel: "Citi Custom Cash",
  },
  {
    id: "citi-premier",
    name: "Strata Premier",
    issuer: "Citi",
    colorHex: "#1d4ed8",
    imageLabel: "Citi Strata Premier",
  },
  {
    id: "capital-one-venture",
    name: "Venture",
    issuer: "Capital One",
    colorHex: "#1a1a1a",
    imageLabel: "Capital One Venture",
  },
  {
    id: "capital-one-venture-x",
    name: "Venture X",
    issuer: "Capital One",
    colorHex: "#111827",
    imageLabel: "Capital One Venture X",
  },
  {
    id: "capital-one-quicksilver",
    name: "Quicksilver",
    issuer: "Capital One",
    colorHex: "#334155",
    imageLabel: "Capital One Quicksilver",
  },
  {
    id: "capital-one-savor",
    name: "Savor",
    issuer: "Capital One",
    colorHex: "#7c3aed",
    imageLabel: "Capital One Savor",
  },
  {
    id: "capital-one-savorone",
    name: "SavorOne",
    issuer: "Capital One",
    colorHex: "#6d28d9",
    imageLabel: "Capital One SavorOne",
  },
  {
    id: "discover-it",
    name: "Discover it",
    issuer: "Discover",
    colorHex: "#f97316",
    imageLabel: "Discover it",
  },
  {
    id: "discover-it-miles",
    name: "Discover it Miles",
    issuer: "Discover",
    colorHex: "#ea580c",
    imageLabel: "Discover it Miles",
  },
  {
    id: "wells-fargo-active-cash",
    name: "Active Cash",
    issuer: "Wells Fargo",
    colorHex: "#d97706",
    imageLabel: "Wells Fargo Active Cash",
  },
  {
    id: "wells-fargo-autograph",
    name: "Autograph",
    issuer: "Wells Fargo",
    colorHex: "#b45309",
    imageLabel: "Wells Fargo Autograph",
  },
  {
    id: "boa-customized-cash",
    name: "Customized Cash Rewards",
    issuer: "Bank of America",
    colorHex: "#e11d48",
    imageLabel: "BofA Customized Cash",
  },
  {
    id: "boa-unlimited-cash",
    name: "Unlimited Cash Rewards",
    issuer: "Bank of America",
    colorHex: "#be123c",
    imageLabel: "BofA Unlimited Cash",
  },
  {
    id: "usbank-altitude-go",
    name: "Altitude Go",
    issuer: "U.S. Bank",
    colorHex: "#0369a1",
    imageLabel: "US Bank Altitude Go",
  },
  {
    id: "usbank-cash-plus",
    name: "Cash+ Visa Signature",
    issuer: "U.S. Bank",
    colorHex: "#075985",
    imageLabel: "US Bank Cash Plus",
  },
  {
    id: "barclays-arrival-plus",
    name: "Arrival Plus",
    issuer: "Barclays",
    colorHex: "#1e40af",
    imageLabel: "Barclays Arrival Plus",
  },
  {
    id: "apple-card",
    name: "Apple Card",
    issuer: "Goldman Sachs",
    colorHex: "#e5e7eb",
    imageLabel: "Apple Card",
  },
  {
    id: "paypal-cashback-mastercard",
    name: "PayPal Cashback Mastercard",
    issuer: "Synchrony",
    colorHex: "#0f4da2",
    imageLabel: "PayPal Cashback Mastercard",
  },
  {
    id: "bilt-mastercard",
    name: "Bilt Mastercard",
    issuer: "Wells Fargo",
    colorHex: "#1f2937",
    imageLabel: "Bilt Mastercard",
  },
  {
    id: "costco-anywhere",
    name: "Costco Anywhere Visa",
    issuer: "Citi",
    colorHex: "#1d4ed8",
    imageLabel: "Costco Anywhere Visa",
  },
  {
    id: "amazon-store-card",
    name: "Amazon Store Card",
    issuer: "Synchrony",
    colorHex: "#0f172a",
    imageLabel: "Amazon Store Card",
  },
];

export const CARD_CATALOG_ENTRIES: CardCatalogEntry[] = RAW.map((r) => ({
  id: r.id,
  name: r.name,
  issuer: r.issuer,
  colorHex: r.colorHex,
  officialDocumentUrl: r.officialDocumentUrl ?? CURATED_OFFICIAL_URLS[r.id],
  imageUrl: r.imageUrl ?? CURATED_IMAGE_URLS[r.id] ?? cardImage(r.imageLabel),
  rules: [],
  rotatingBonusCalendar: ROTATING_CALENDARS_BY_SLUG[r.id],
}));
