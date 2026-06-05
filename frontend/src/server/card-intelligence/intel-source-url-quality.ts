/**
 * URL-shape rules for intel discovery (all cards — not per-slug curated lists).
 * Rejects category/account hubs; prefers product-detail pages like top Google results.
 */

const CATEGORY_HUB_PATH =
  /\/gp\/browse\b|\/browse\.html\b|cc_landing|nav_youraccount|\/view-all\b|\/credit-card-brands\b|\/cards\/branding\b|\/search\?|\/s\?k=|\/b\?node=|node=\d{6,}/i;

const CATEGORY_HUB_QUERY =
  /(?:^|[?&])(?:node|ref_)=/i;

const THIRD_PARTY_INTEL_HOST =
  /(?:^|\.)((?:www\.)?(?:creditkarma|nerdwallet|wallethub|forbes|cnbc|money\.usnews|reddit|bankrate|thepointsguy|doctorofcredit))\.[a-z.]+$/i;

const APPLY_FORM_PATH =
  /termsSimpleApply|simpleApply\.controller|\/oad\/terms|\/apply\/terms\?|locationCode=/i;

/** Blogs / aggregators — never official intel. */
export function isThirdPartyIntelHost(hostname: string): boolean {
  return THIRD_PARTY_INTEL_HOST.test(hostname.toLowerCase());
}

/** Issuer apply flows — legal PDF shells, not product marketing pages. */
export function isIssuerApplyFormUrl(urlOrPath: string): boolean {
  const blob = urlOrPath.toLowerCase();
  if (/applications\./i.test(blob) && APPLY_FORM_PATH.test(blob)) return true;
  return APPLY_FORM_PATH.test(blob) && /usbank|chase|citi|capitalone/i.test(blob);
}

/** Bank-wide pricing / disclosure PDFs — not a single card's rewards page. */
export function isGenericIssuerDisclosureDocument(urlOrPath: string): boolean {
  const blob = urlOrPath.toLowerCase();
  if (/consumer-pricing-information\.pdf/i.test(blob)) return true;
  if (/\/disclosures\/consumer-pricing/i.test(blob)) return true;
  if (/rewards\.usbank\.com/i.test(blob) && /\.pdf/i.test(blob)) {
    return !/altitude|cash[-+]|flex[-+]|shopper/i.test(blob);
  }
  return false;
}

/** Generic bank card index (Synchrony « /credit-card ») — not a product page. */
export function isGenericIssuerCardHub(urlOrPath: string): boolean {
  if (/\/dp\/[a-z0-9]{8,}/i.test(urlOrPath)) return false;
  const blob = urlOrPath.toLowerCase();
  if (/synchrony\.com\/credit-card\/?$/i.test(blob)) return true;
  if (/mysynchrony\.com\/credit-cards\/?$/i.test(blob)) return true;
  if (/synchronybank\.com\/credit-card/i.test(blob) && !/\/[^/]+-[^/]+/.test(blob)) {
    return true;
  }
  return false;
}

/** Account / marketplace shells — high nav « credit card » text, no product terms. */
export function isIntelSourceCategoryHub(urlOrPath: string): boolean {
  const blob = urlOrPath.toLowerCase();
  if (CATEGORY_HUB_PATH.test(blob)) return true;
  if (/\/gp\/browse/i.test(blob) && CATEGORY_HUB_QUERY.test(blob)) return true;
  if (/ref_=nav_youraccount/i.test(blob)) return true;
  return false;
}

function slugTokens(productSlug: string): string[] {
  return productSlug
    .toLowerCase()
    .split("-")
    .filter((t) => t.length > 2 && t !== "card" && t !== "credit");
}

function pathLetters(href: string): string {
  return href.toLowerCase().replace(/[^a-z0-9]/gi, "");
}

/**
 * Positive signal: URL looks like a single product page (Amazon /dp/, Amex /card/, etc.).
 */
export function scoreIntelProductPageUrl(
  url: string,
  productSlug: string,
  cardName?: string,
): number {
  let s = 0;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return -999;
  }

  const path = (parsed.pathname + parsed.search).toLowerCase();
  const letters = pathLetters(parsed.pathname);

  if (isIntelSourceCategoryHub(url)) return -250;
  if (isThirdPartyIntelHost(parsed.hostname)) return -300;
  if (isIssuerApplyFormUrl(url)) return -280;
  if (isGenericIssuerCardHub(url)) return -200;
  if (isGenericIssuerDisclosureDocument(url)) return -220;

  if (/\/dp\/[a-z0-9]{8,}/i.test(path)) s += 120;
  if (/usbank\.com/i.test(parsed.hostname) && /\/credit-cards\/.*\.html/i.test(path)) {
    s += 90;
  }
  if (/citi\.com/i.test(parsed.hostname) && /double-cash|custom-cash/i.test(path)) {
    s += 85;
  }
  if (/\/gp\/product\//i.test(path)) s += 90;
  if (/\/credit-cards\/card\/[^/]+\/?$/i.test(path)) s += 95;
  if (/\/digital-wallet\/manage-money\//i.test(path)) s += 90;
  if (/\/apple-card/i.test(path)) s += 100;

  const slugCompact = productSlug.replace(/-/g, "");
  if (slugCompact.length >= 5 && letters.includes(slugCompact)) s += 70;

  const tokens = slugTokens(productSlug);
  const tokenHits = tokens.filter((t) => path.includes(t) || letters.includes(t)).length;
  s += tokenHits * 22;

  if (cardName) {
    const words = cardName
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter((w) => w.length > 3);
    const nameHits = words.filter((w) => letters.includes(w)).length;
    s += nameHits * 12;
  }

  if (/\/Synchrony-Bank-/i.test(parsed.pathname)) s += 55;

  return s;
}

export function shouldTrustSearchRankedProductUrl(
  url: string,
  args: {
    productSlug: string;
    cardName: string;
    searchRank: number;
    hint?: string;
  },
): boolean {
  if (args.searchRank > 1) return false;
  if (isIntelSourceCategoryHub(url)) return false;
  const productScore = scoreIntelProductPageUrl(
    url,
    args.productSlug,
    args.cardName,
  );
  if (productScore < 45) return false;
  if (args.hint?.trim()) {
    const hint = args.hint.toLowerCase();
    if (
      /(cash\s*back|earn|rewards?|points|apr|credit\s+card|store\s+card)/i.test(
        hint,
      )
    ) {
      return true;
    }
  }
  return productScore >= 70 || args.searchRank === 0;
}

export function normalizeIntelUrlForExclude(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    return u.toString();
  } catch {
    return raw.split("#")[0] ?? raw;
  }
}

export function isUrlExcluded(raw: string, excludeUrls: string[]): boolean {
  if (!excludeUrls.length) return false;
  const norm = normalizeIntelUrlForExclude(raw);
  return excludeUrls.some((e) => normalizeIntelUrlForExclude(e) === norm);
}
