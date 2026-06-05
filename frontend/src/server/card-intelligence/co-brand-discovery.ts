import { cleanCardProductName } from "@/server/catalog-infer";
import {
  normalizeIssuer,
  resolveIssuerOfficialHosts,
} from "@/server/card-intelligence/issuer-official-domains";
import { resolveIssuerOfficialHostsWithDb } from "@/server/card-intelligence/issuer-official-hosts";
import { coreCardQueryPhrase } from "@/server/card-intelligence/pdf-discovery-query";

const CARD_SUFFIX_RE =
  /\b(store\s+card|credit\s+card|visa\s+card|mastercard|visa|mastercard®|cardmember)\b/gi;

/** Retailer slug → issuing bank (US co-branded store cards). */
const RETAILER_TO_BANK: Record<string, string> = {
  amazon: "Synchrony",
  macys: "Citi",
  macy: "Citi",
  bloomingdales: "Citi",
  "bloomingdale s": "Citi",
  costco: "Citi",
  "best buy": "Citi",
  bestbuy: "Citi",
  exxon: "Citi",
  mobil: "Citi",
  shell: "Citi",
  lowes: "Synchrony",
  "lowe s": "Synchrony",
  paypal: "Synchrony",
  gap: "Synchrony",
  "old navy": "Synchrony",
  banana: "Synchrony",
  athleta: "Synchrony",
  walmart: "Capital One",
  target: "TD Bank",
  nordstrom: "TD Bank",
  kohls: "Capital One",
  "home depot": "Citi",
  homedepot: "Citi",
  sams: "Synchrony",
  "sam s club": "Synchrony",
  ebay: "Synchrony",
  venmo: "Synchrony",
  wayfair: "Citi",
  llbean: "Barclays",
  "l l bean": "Barclays",
  rei: "Capital One",
  bjs: "Barclays",
  "b j s": "Barclays",
  dicks: "Synchrony",
  "dick s": "Synchrony",
  "dick s sporting goods": "Synchrony",
  nike: "Synchrony",
  ikea: "Comenity",
  sephora: "Comenity",
  ulta: "Comenity",
  chevron: "Synchrony",
  exxonmobil: "Citi",
  apple: "Goldman Sachs",
};

/** Known retailer apex domains (slug key → hosts). */
const RETAILER_HOSTS: Record<string, string[]> = {
  amazon: ["amazon.com"],
  macys: ["macys.com"],
  macy: ["macys.com"],
  bloomingdales: ["bloomingdales.com"],
  costco: ["costco.com"],
  bestbuy: ["bestbuy.com"],
  "best buy": ["bestbuy.com"],
  lowes: ["lowes.com"],
  paypal: ["paypal.com"],
  gap: ["gap.com"],
  "old navy": ["oldnavy.com"],
  walmart: ["walmart.com"],
  target: ["target.com"],
  nordstrom: ["nordstrom.com"],
  kohls: ["kohls.com"],
  homedepot: ["homedepot.com"],
  "home depot": ["homedepot.com"],
  wayfair: ["wayfair.com"],
  rei: ["rei.com"],
  dicks: ["dickssportinggoods.com"],
  nike: ["nike.com"],
  sephora: ["sephora.com"],
  ulta: ["ulta.com"],
  apple: ["apple.com"],
};

const BANK_ISSUER_KEYS = new Set([
  "chase",
  "citi",
  "capital one",
  "discover",
  "wells fargo",
  "bank of america",
  "bofa",
  "american express",
  "amex",
  "us bank",
  "u s bank",
  "barclays",
  "goldman sachs",
  "synchrony",
  "td bank",
  "td",
  "pnc",
  "truist",
]);

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyRetailer(key: string): string {
  return key.replace(/\s+/g, "").replace(/'/g, "");
}

export type CoBrandContext = {
  retailerBrand: string;
  retailerKey: string;
  retailerHosts: string[];
  bankIssuer: string;
};

export function isKnownBankIssuer(issuer: string): boolean {
  const k = normalizeIssuer(issuer);
  if (!k) return false;
  if (resolveIssuerOfficialHosts(issuer).length > 0) return true;
  return BANK_ISSUER_KEYS.has(k);
}

function guessRetailerHosts(retailerKey: string): string[] {
  const norm = normalizeKey(retailerKey);
  if (RETAILER_HOSTS[norm]?.length) {
    return RETAILER_HOSTS[norm]!;
  }
  const firstWord = norm.split(" ")[0] ?? "";
  if (firstWord && RETAILER_HOSTS[firstWord]?.length) {
    return RETAILER_HOSTS[firstWord]!;
  }
  for (const [key, hosts] of Object.entries(RETAILER_HOSTS)) {
    if (norm === key || norm.startsWith(`${key} `) || norm.includes(` ${key} `)) {
      return hosts;
    }
  }
  const slug = slugifyRetailer(firstWord || norm);
  if (!slug || slug.length < 3) return [];
  const hosts = [`${slug}.com`];
  if (!slug.endsWith("s")) hosts.push(`${slug}s.com`);
  return hosts;
}

/** Catalog slug prefix → retailer (e.g. `paypal-cashback-mastercard` → paypal). */
export function retailerKeyFromProductSlug(productSlug: string): string | null {
  const parts = productSlug.toLowerCase().split("-").filter(Boolean);
  if (!parts.length) return null;
  const keys = Object.keys(RETAILER_HOSTS).sort(
    (a, b) => b.split(" ").length - a.split(" ").length,
  );
  for (const key of keys) {
    const keyParts = key.split(" ");
    if (keyParts.length <= parts.length) {
      const match = keyParts.every((kp, i) => parts[i] === kp);
      if (match) return key;
    }
  }
  const first = parts[0] ?? "";
  if (RETAILER_HOSTS[first] || RETAILER_TO_BANK[first]) return first;
  return null;
}

function lookupBankForRetailerKey(key: string): string | undefined {
  return RETAILER_TO_BANK[key];
}

/** True only for mapped store / retailer brands — not issuer product lines (e.g. « Altitude Go »). */
function isKnownRetailerBrand(retailerBrand: string): boolean {
  const norm = normalizeKey(retailerBrand);
  if (!norm || norm.length < 2) return false;
  const first = norm.split(" ")[0] ?? "";
  if (RETAILER_HOSTS[norm]?.length || RETAILER_HOSTS[first]?.length) return true;
  if (RETAILER_TO_BANK[norm] || RETAILER_TO_BANK[first]) return true;
  for (const key of Object.keys(RETAILER_HOSTS)) {
    if (norm === key || norm.startsWith(`${key} `) || norm.includes(` ${key} `)) {
      return true;
    }
  }
  for (const key of Object.keys(RETAILER_TO_BANK)) {
    if (norm === key || norm.startsWith(`${key} `) || norm.includes(` ${key} `)) {
      return true;
    }
  }
  return false;
}

function extractRetailerBrand(cardName: string, bankIssuer: string): string | null {
  let rest = cleanCardProductName(cardName);
  const bankN = normalizeKey(bankIssuer);
  if (bankN.length >= 3) {
    const bankRe = new RegExp(
      bankIssuer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    rest = rest.replace(bankRe, " ").trim();
  }
  rest = rest.replace(CARD_SUFFIX_RE, " ").replace(/\s+/g, " ").trim();
  if (rest.length < 2) return null;
  const key = normalizeKey(rest);
  if (key === bankN || key.length < 2) return null;
  if (BANK_ISSUER_KEYS.has(key)) return null;
  return rest;
}

/**
 * Store / co-branded cards (Macy's + Citi, Amazon + Synchrony, etc.).
 */
export function detectCoBrandContext(
  issuer: string,
  cardName: string,
): CoBrandContext | null {
  const name = cleanCardProductName(cardName);
  if (name.length < 3) return null;

  const issuerKey = normalizeKey(issuer);
  const nameKey = normalizeKey(name);

  if (isKnownBankIssuer(issuer)) {
    const retailerBrand = extractRetailerBrand(name, issuer);
    if (!retailerBrand || !isKnownRetailerBrand(retailerBrand)) return null;
    const retailerKey =
      normalizeKey(retailerBrand).split(" ")[0] || normalizeKey(retailerBrand);
    const retailerHosts = guessRetailerHosts(retailerKey);
    if (!retailerHosts.length) return null;
    return {
      retailerBrand,
      retailerKey,
      retailerHosts,
      bankIssuer: issuer.trim(),
    };
  }

  const bankFromRetailer =
    lookupBankForRetailerKey(issuerKey) ?? lookupBankForRetailerKey(nameKey);
  if (!bankFromRetailer) {
    const firstToken = nameKey.split(" ")[0] ?? "";
    const bank2 = lookupBankForRetailerKey(firstToken);
    if (!bank2) return null;
    const retailerHosts = guessRetailerHosts(issuerKey || firstToken);
    if (!retailerHosts.length) return null;
    return {
      retailerBrand: issuer.trim() || name,
      retailerKey: issuerKey || firstToken,
      retailerHosts,
      bankIssuer: bank2,
    };
  }

  const retailerKey = issuerKey || nameKey.split(" ")[0] || "";
  const retailerHosts = guessRetailerHosts(retailerKey);
  if (!retailerHosts.length) return null;

  return {
    retailerBrand: issuer.trim() || name,
    retailerKey,
    retailerHosts,
    bankIssuer: bankFromRetailer,
  };
}

export async function resolveIntelDiscoveryHosts(
  issuer: string,
  cardName: string,
  productSlug?: string,
): Promise<{
  hosts: string[];
  coBrand: CoBrandContext | null;
  issuerForDiscovery: string;
  cardNameForDiscovery: string;
}> {
  let coBrand = detectCoBrandContext(issuer, cardName);
  if (!coBrand && productSlug) {
    const slugRetailer = retailerKeyFromProductSlug(productSlug);
    const bank = slugRetailer ? lookupBankForRetailerKey(slugRetailer) : undefined;
    const hosts = slugRetailer ? guessRetailerHosts(slugRetailer) : [];
    if (slugRetailer && bank && hosts.length) {
      coBrand = {
        retailerBrand:
          extractRetailerBrand(cardName, issuer) ??
          slugRetailer.charAt(0).toUpperCase() + slugRetailer.slice(1),
        retailerKey: slugRetailer,
        retailerHosts: hosts,
        bankIssuer: bank,
      };
    }
  }
  const issuerForDiscovery = coBrand?.bankIssuer ?? issuer.trim();
  const cardNameForDiscovery = coBrand
    ? `${coBrand.retailerBrand} ${cleanCardProductName(cardName)}`.trim()
    : cardName.trim();

  const hosts = new Set(
    await resolveIssuerOfficialHostsWithDb(issuerForDiscovery),
  );
  if (coBrand) {
    for (const h of coBrand.retailerHosts) hosts.add(h);
    if (issuerForDiscovery.toLowerCase().includes("citi")) {
      hosts.add("online.citi.com");
    }
  }

  return {
    hosts: [...hosts],
    coBrand,
    issuerForDiscovery,
    cardNameForDiscovery,
  };
}

/** Marketing / benefits pages for store co-brands (retailer + bank hubs). */
export function guessCoBrandMarketingUrls(ctx: CoBrandContext): string[] {
  const urls: string[] = [];
  const slug = slugifyRetailer(ctx.retailerKey);
  const q = encodeURIComponent(ctx.retailerBrand);

  for (const host of ctx.retailerHosts) {
    const bases = [`https://www.${host}`, `https://${host}`];
    for (const base of bases) {
      urls.push(
        `${base}/credit-card`,
        `${base}/credit-cards`,
        `${base}/creditcard`,
        `${base}/c/credit-card`,
        `${base}/account/credit-card`,
        `${base}/store/credit-card`,
        `${base}/lp/credit-card`,
        `${base}/search?q=${q}%20credit%20card`,
      );
      if (host.includes("macys")) {
        urls.push(
          "https://www.macys.com/account/credit-card",
          "https://www.macys.com/credit-card",
        );
      }
      if (host.includes("amazon")) {
        urls.push(
          "https://www.amazon.com/gp/cobrandcard/marketing.html",
          "https://www.amazon.com/credit/store-card",
        );
      }
      if (host.includes("apple")) {
        urls.push(
          "https://www.apple.com/apple-card/",
          "https://www.apple.com/apple-card",
        );
      }
      if (host.includes("costco")) {
        urls.push("https://www.costco.com/credit-card.html");
      }
      if (host.includes("paypal")) {
        urls.push(
          "https://www.paypal.com/us/digital-wallet/manage-money/paypal-cashback-mastercard",
          "https://www.paypal.com/us/digital-wallet/manage-money",
          "https://www.paypal.com/us/credit-cards",
          "https://www.paypal.com/credit-cards",
        );
      }
      if (host.includes("venmo")) {
        urls.push("https://venmo.com/about/credit-card");
      }
    }
  }

  const bank = normalizeIssuer(ctx.bankIssuer);
  if (bank.includes("citi")) {
    urls.push(
      "https://www.citi.com/credit-cards/credit-card-brands",
      `https://www.citi.com/credit-cards/view-all-credit-cards?keyword=${slug}`,
      "https://online.citi.com/US/ag/cards/branding",
    );
  }
  if (bank.includes("synchrony")) {
    urls.push(`https://www.synchrony.com/credit-cards/${slug}.html`);
    urls.push(`https://www.mysynchrony.com/credit-cards/${slug}.html`);
  }
  if (bank.includes("capital one")) {
    urls.push(
      `https://www.capitalone.com/credit-cards/${slug}/`,
      `https://www.capitalone.com/credit-cards/${slug}-credit-card/`,
    );
  }

  return [...new Set(urls)];
}

/** Product-page URLs from catalog slug on the retailer site (PayPal, Amazon, etc.). */
export function guessRetailerProductPageUrls(
  productSlug: string,
  ctx: CoBrandContext,
): string[] {
  const urls: string[] = [];
  const slug = productSlug.trim().toLowerCase();
  if (!slug) return urls;

  for (const host of ctx.retailerHosts) {
    const bases = [`https://www.${host}`, `https://${host}`];
    for (const base of bases) {
      if (host.includes("apple")) {
        urls.push(`${base}/apple-card/`, `${base}/apple-card`);
      }
      if (host.includes("paypal")) {
        urls.push(
          `${base}/us/digital-wallet/manage-money/${slug}`,
          `${base}/us/digital-wallet/manage-money/paypal-cashback-mastercard`,
        );
      }
      urls.push(
        `${base}/credit-cards/${slug}`,
        `${base}/credit-card/${slug}`,
        `${base}/${slug}`,
      );
    }
  }

  return [...new Set(urls)];
}

/** Extra ranking for co-brand intel URLs (benefits on retailer site, not legal index). */
export function coBrandIntelPathBonus(
  url: string,
  ctx: CoBrandContext | null | undefined,
): number {
  if (!ctx) return 0;
  const blob = url.toLowerCase();
  const slug = slugifyRetailer(ctx.retailerKey);
  let b = 0;

  if (ctx.retailerHosts.some((h) => blob.includes(h))) {
    b += 35;
    if (/(benefit|reward|earn|cash\s*back|points|save\s+\d|exclusive\s+offer)/i.test(blob)) {
      b += 45;
    }
    if (/\/credit[-_]?cards?\b/i.test(blob)) b += 28;
    if (/\/digital-wallet\//i.test(blob)) b += 55;
    if (slug.length >= 3 && blob.includes(slug)) b += 40;
    if (/(terms|agreement|cardmember|pricingandterms|schumer)/i.test(blob)) {
      b -= 18;
    }
  }

  if (slug.length >= 3 && blob.includes(slug)) b += 22;

  if (/cardmember-agreement|\/company\/legal\//i.test(blob)) b -= 55;
  if (/benefits?\s*summary|rewards?\s*program|offer\s*details/i.test(blob)) {
    b += 32;
  }

  return b;
}

export function buildCoBrandScopedSearchQuery(args: {
  hosts: string[];
  coBrand: CoBrandContext;
  cardName: string;
  exclusionTerms: string[];
}): string {
  const siteClause = [...new Set(args.hosts)]
    .map((h) => `site:${h}`)
    .join(" OR ");
  const core =
    coreCardQueryPhrase(args.coBrand.retailerBrand) ??
    args.coBrand.retailerBrand;
  const neg = args.exclusionTerms
    .filter((t) => t.length >= 3)
    .map((t) => `-${t}`)
    .join(" ");
  return [
    `(${siteClause})`,
    `"${core}"`,
    `"${args.coBrand.bankIssuer}"`,
    '"credit card"',
    "(benefits OR rewards OR earning OR cash back OR points OR offer details)",
    "-cardmember-agreements -company/legal -features-benefits",
    neg,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Do not replace a known bank issuer when the PDF host is the retailer site. */
export function shouldPreserveBankIssuerFromRetailerPdf(
  productIssuer: string,
  documentHostname: string,
  coBrand: CoBrandContext | null,
): boolean {
  if (!coBrand || !isKnownBankIssuer(productIssuer)) return false;
  const h = documentHostname.toLowerCase();
  return coBrand.retailerHosts.some(
    (apex) => h === apex || h.endsWith(`.${apex}`),
  );
}

export function coBrandImageSearchQueries(args: {
  issuer: string;
  cardName: string;
  coBrand: CoBrandContext;
}): string[] {
  const brand = args.coBrand.retailerBrand;
  const bank = args.coBrand.bankIssuer;
  const retailerSite = args.coBrand.retailerHosts[0];
  return [
    `${brand} ${bank} credit card official card art png`,
    `site:${retailerSite} ${brand} credit card png`,
    `${brand} credit card png site:citi.com OR site:synchrony.com OR site:${retailerSite}`,
    `"${brand}" store credit card product image`,
  ];
}
