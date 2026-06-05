import { CURATED_CATALOG_IMAGE_URLS } from "@/server/card-catalog.entries";
import {
  buildCatalogImageExclusionTerms,
  cousinSlugExclusionTerms,
  scorePdfCandidate,
  VARIANT_TIER_TOKENS,
  variantTokensAbsentFromCardName,
} from "@/server/card-intelligence/pdf-discovery-query";

const VARIANT_TIER_SET = new Set<string>(VARIANT_TIER_TOKENS);

const GENERIC_SLUG_PARTS = new Set([
  "card",
  "cards",
  "credit",
  "visa",
  "mastercard",
  "bank",
  "rewards",
  "the",
  "and",
]);

function normalizeSlugParts(slug: string): string[] {
  return slug
    .toLowerCase()
    .split("-")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function pathLetters(url: string): string {
  return url.toLowerCase().replace(/[^a-z0-9]/gi, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termAppearsInUrl(term: string, url: string): boolean {
  const t = term.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (t.length < 3) return false;
  const letters = pathLetters(url);
  if (t.length >= 4) {
    return letters.includes(t);
  }
  return new RegExp(`\\b${escapeRegExp(t)}\\b`, "i").test(url);
}

/** Product tokens after issuer prefix (e.g. `sapphire`, `reserve`). */
export function catalogImageSlugTailParts(
  productSlug: string,
  issuer: string,
): string[] {
  const parts = normalizeSlugParts(productSlug);
  if (parts.length < 2) return parts.filter((p) => !GENERIC_SLUG_PARTS.has(p));

  const issuerKey = issuer
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const issuerParts = issuerKey.split(" ").filter((w) => w.length > 0);
  let start = 0;
  if (
    issuerParts.length &&
    parts.slice(0, issuerParts.length).join("-") === issuerParts.join("-")
  ) {
    start = issuerParts.length;
  } else if (issuerParts[0] && parts[0] === issuerParts[0]) {
    start = 1;
  }

  return parts
    .slice(start)
    .filter((p) => p.length >= 2 && !GENERIC_SLUG_PARTS.has(p));
}

/**
 * Tokens that distinguish this slug from cousin catalog products (same issuer family).
 */
export function catalogImageDiscriminativeSlugParts(
  productSlug: string,
  issuer: string,
): string[] {
  const tail = catalogImageSlugTailParts(productSlug, issuer);
  const cousinExclusions = new Set(
    cousinSlugExclusionTerms(issuer, productSlug).map((t) => t.toLowerCase()),
  );
  const discriminative = tail.filter(
    (p) => p.length >= 3 && !cousinExclusions.has(p),
  );
  if (discriminative.length > 0) return discriminative;
  return tail.filter((p) => p.length >= 3);
}

/** Every token here must appear in the image URL (variant-safe). */
export function catalogImageRequiredPathTokens(
  productSlug: string,
  issuer: string,
): string[] {
  const tail = catalogImageSlugTailParts(productSlug, issuer);
  const variantInSlug = tail.filter((p) => VARIANT_TIER_SET.has(p));
  const discriminative = catalogImageDiscriminativeSlugParts(
    productSlug,
    issuer,
  );
  return [...new Set([...variantInSlug, ...discriminative])].filter(
    (p) => p.length >= 3,
  );
}

export function isCuratedCatalogImageUrl(
  productSlug: string,
  url: string,
): boolean {
  const curated = CURATED_CATALOG_IMAGE_URLS[productSlug]?.trim();
  return Boolean(curated && curated === url.trim());
}

const PRODSTATIC_CARD_ART =
  /(?:^|\/)(?:cdn\.prodstatic\.com|prodstatic\.com)\/shared\/images\/cards\//i;

const OTHER_ISSUER_NAMES = [
  "american express",
  "amex",
  "chase",
  "capital one",
  "citi",
  "citibank",
  "discover",
  "wells fargo",
  "bank of america",
  "barclays",
  "us bank",
  "u s bank",
  "synchrony",
  "apple card",
  "bilt",
];

function normalizeImageMatchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/&#(?:174|8482|x2122);/gi, "")
    .replace(/[®™]/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isProdstaticCardArtUrl(url: string): boolean {
  return (
    PRODSTATIC_CARD_ART.test(url) ||
    /creditcards\.com\/ext\/cdn\.prodstatic\.com\/shared\/images\/cards\//i.test(
      url,
    )
  );
}

/** Search result title clearly describes this card (issuer + product name). */
export function catalogImageSearchTitleMatchesCard(args: {
  title: string;
  cardName: string;
  issuer: string;
}): boolean {
  const blob = normalizeImageMatchText(args.title);
  if (!blob) return false;

  const issuerN = normalizeImageMatchText(args.issuer);
  const issuerTokens = issuerN.split(" ").filter((t) => t.length > 2);
  const issuerHit =
    (issuerTokens.length >= 2 &&
      issuerTokens.every((t) => blob.includes(t))) ||
    (issuerTokens[0] && blob.includes(issuerTokens[0]!));

  const nameTokens = normalizeImageMatchText(args.cardName)
    .split(" ")
    .filter(
      (t) =>
        t.length > 2 &&
        !["card", "visa", "mastercard", "credit", "rewards"].includes(t),
    );
  if (!nameTokens.length) return false;
  const nameHits = nameTokens.filter((t) => blob.includes(t)).length;
  const required = Math.min(2, nameTokens.length);
  return Boolean(issuerHit && nameHits >= required);
}

/** Title names a different issuer product (e.g. Quicksilver title for Active Cash). */
export function catalogImageSearchTitleConflictsWithCard(args: {
  title: string;
  cardName: string;
  issuer: string;
  productSlug: string;
}): boolean {
  const blob = normalizeImageMatchText(args.title);
  const issuerN = normalizeImageMatchText(args.issuer);

  for (const other of OTHER_ISSUER_NAMES) {
    if (issuerN.includes(other) || other.includes(issuerN)) continue;
    if (blob.includes(other)) return true;
  }

  for (const ex of buildCatalogImageExclusionTerms(
    args.issuer,
    args.productSlug,
  )) {
    if (ex.length < 4) continue;
    const exN = normalizeImageMatchText(ex);
    if (!exN) continue;
    const inTitle = blob.includes(exN);
    const inCard = normalizeImageMatchText(args.cardName).includes(exN);
    if (inTitle && !inCard) return true;
  }

  return false;
}

/** Marketing banners / category headers — not rectangular card art. */
export function isMarketingBannerImagePath(url: string): boolean {
  const p = url.toLowerCase();
  return (
    /categoryheader/i.test(p) ||
    /category-header/i.test(p) ||
    /\/site-assets\//i.test(p) ||
    /brand-page/i.test(p) ||
    /\/hero[-_]?/i.test(p) ||
    /\/header[-_]?image/i.test(p) ||
    /\/credit-intel\//i.test(p) ||
    /benefits-updated/i.test(p) ||
    /\/benefits\//i.test(p)
  );
}

function chaseSlugTail(productSlug: string): string | null {
  if (!productSlug.startsWith("chase-")) return null;
  return productSlug.slice("chase-".length);
}

/** True when URL looks like official issuer card-art (not a marketing banner). */
export function catalogImageIsIssuerCardArtPath(
  url: string,
  productSlug: string,
): boolean {
  const path = url.toLowerCase();
  if (isMarketingBannerImagePath(url)) return false;
  if (catalogImageIsIssuerExactPath(url, productSlug)) return true;

  const chaseTail = chaseSlugTail(productSlug);
  if (chaseTail && /creditcards\.chase\.com/i.test(url)) {
    if (!/\/card-art\//i.test(path) && !/\/card-${chaseTail}\//i.test(path)) {
      return false;
    }
    const compact = chaseTail.replace(/-/g, "");
    const underscored = chaseTail.replace(/-/g, "_");
    return (
      path.includes(underscored) ||
      path.includes(compact) ||
      path.includes(`/card-${chaseTail}/`)
    );
  }

  if (/\/card-art\//i.test(path) || /\/card_art\//i.test(path)) return true;
  if (/jpmc-marketplace\/card-/i.test(path)) return true;
  if (/ecm\.capitalone\.com\/wcm\/card\/products/i.test(path)) return true;

  return false;
}

/** Issuer CDN path mirrors catalog slug (e.g. Chase `card-sapphire-reserve/...`). */
export function catalogImageIsIssuerExactPath(
  url: string,
  productSlug: string,
): boolean {
  const path = url.toLowerCase();
  if (productSlug.startsWith("chase-")) {
    const tail = productSlug.slice("chase-".length);
    const underscored = tail.replace(/-/g, "_");
    return (
      path.includes(`/card-${tail}/card-${tail}.`) ||
      path.includes(`card-${tail}/card-${tail}.`) ||
      (path.includes("/card-art/") &&
        (path.includes(underscored) || path.includes(tail.replace(/-/g, ""))))
    );
  }
  if (productSlug.startsWith("amex-")) {
    const tail = productSlug.slice("amex-".length);
    return (
      path.includes(`/card-art/consumer/${tail}/`) ||
      path.includes(`/card-art/consumer/${tail}-card/`) ||
      (productSlug === "amex-platinum" && path.includes("platinum-metal"))
    );
  }
  if (productSlug.startsWith("capital-one-")) {
    const tail = productSlug.slice("capital-one-".length);
    return path.includes(`${tail}-card-art`) || path.includes(`${tail}cardart`);
  }
  if (productSlug.startsWith("citi-")) {
    const tail = productSlug.slice("citi-".length);
    return path.includes(`citi-${tail}`) || path.includes(`citi-${tail}-card`);
  }
  if (productSlug.startsWith("discover-")) {
    const tail = productSlug.slice("discover-".length);
    return path.includes(`discover-${tail}`);
  }
  return false;
}

export function catalogImageExactPathScoreBonus(
  url: string,
  productSlug: string,
  issuer: string,
): number {
  if (isMarketingBannerImagePath(url)) return -400;
  if (isCuratedCatalogImageUrl(productSlug, url)) return 500;
  if (catalogImageIsIssuerExactPath(url, productSlug)) return 400;
  if (catalogImageIsIssuerCardArtPath(url, productSlug)) return 320;
  if (isProdstaticCardArtUrl(url)) return 200;
  const required = catalogImageRequiredPathTokens(productSlug, issuer);
  const letters = pathLetters(url);
  if (required.length > 0 && required.every((p) => letters.includes(p.replace(/[^a-z0-9]/g, "")))) {
    return 150;
  }
  const slugCompact = productSlug.toLowerCase().replace(/-/g, "");
  if (slugCompact.length >= 10 && letters.includes(slugCompact)) return 80;
  return 0;
}

/**
 * URL path must reflect the catalog slug tail (variant-safe), unless explicitly curated.
 */
export function catalogImageUrlMatchesProductSlug(args: {
  url: string;
  productSlug: string;
  issuer: string;
}): boolean {
  const url = args.url.trim();
  if (!url) return false;
  if (isCuratedCatalogImageUrl(args.productSlug, url)) return true;
  if (catalogImageIsIssuerExactPath(url, args.productSlug)) return true;

  const required = catalogImageRequiredPathTokens(
    args.productSlug,
    args.issuer,
  );
  if (required.length === 0) {
    const tail = catalogImageSlugTailParts(args.productSlug, args.issuer);
    return tail.some((p) => p.length >= 4 && termAppearsInUrl(p, url));
  }

  return required.every((p) => termAppearsInUrl(p, url));
}

/** Reject URLs that mention another catalog variant or forbidden tier tokens. */
export function catalogImageUrlHasConflictingVariant(args: {
  url: string;
  cardName: string;
  productSlug: string;
  issuer: string;
}): boolean {
  const url = args.url.trim();
  if (!url) return false;
  if (isCuratedCatalogImageUrl(args.productSlug, url)) return false;

  for (const tier of variantTokensAbsentFromCardName(
    args.cardName,
    args.issuer,
  )) {
    if (termAppearsInUrl(tier, url)) return true;
  }
  for (const ex of buildCatalogImageExclusionTerms(
    args.issuer,
    args.productSlug,
  )) {
    if (ex.length < 3) continue;
    if (termAppearsInUrl(ex, url)) return true;
  }

  const ownVariants = catalogImageSlugTailParts(
    args.productSlug,
    args.issuer,
  ).filter((p) => VARIANT_TIER_SET.has(p));
  const foreignVariants = VARIANT_TIER_TOKENS.filter(
    (t) => !ownVariants.includes(t),
  );
  let foreignHit = 0;
  for (const t of foreignVariants) {
    if (termAppearsInUrl(t, url)) foreignHit++;
  }
  if (foreignHit >= 2) return true;

  return false;
}

/** Rank a card-art URL (issuer CDN, scrape, or image search hit). */
export function scoreCatalogImageUrl(args: {
  url: string;
  hint?: string;
  cardName: string;
  productSlug: string;
  issuer?: string;
  resultIndex?: number;
}): number {
  const issuer = args.issuer ?? "";
  let s = scorePdfCandidate({
    url: args.url,
    hint: args.hint ?? "",
    cardName: args.cardName,
    productSlug: args.productSlug,
    exclusionTerms: buildCatalogImageExclusionTerms(issuer, args.productSlug),
    issuer,
    resultIndex: args.resultIndex ?? 0,
  });

  s += catalogImageExactPathScoreBonus(args.url, args.productSlug, issuer);

  if (
    !catalogImageUrlMatchesProductSlug({
      url: args.url,
      productSlug: args.productSlug,
      issuer,
    })
  ) {
    s -= 120;
  }
  if (
    catalogImageUrlHasConflictingVariant({
      url: args.url,
      cardName: args.cardName,
      productSlug: args.productSlug,
      issuer,
    })
  ) {
    s -= 250;
  }
  if (args.hint?.trim()) {
    if (
      catalogImageSearchTitleMatchesCard({
        title: args.hint,
        cardName: args.cardName,
        issuer,
      })
    ) {
      s += 220;
    }
    if (
      catalogImageSearchTitleConflictsWithCard({
        title: args.hint,
        cardName: args.cardName,
        issuer,
        productSlug: args.productSlug,
      })
    ) {
      s -= 400;
    }
  }

  return s;
}

const ISSUER_IMAGE_HOST =
  /(creditcards\.chase\.com|americanexpress\.com|ecm\.capitalone\.com|\.citi\.com|discover\.com|usbank\.com|wellsfargo\.com|bankofamerica\.com)/i;

function isIssuerHostedImageUrl(url: string): boolean {
  try {
    return ISSUER_IMAGE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Open-web human search hits on issuer CDNs must look like card-art, not banners.
 */
export function catalogImageUrlAllowedForHumanSearchPersist(args: {
  url: string;
  title: string;
  productSlug: string;
  issuer: string;
  cardName: string;
  searchRank: number;
}): boolean {
  if (isMarketingBannerImagePath(args.url)) return false;
  if (isCuratedCatalogImageUrl(args.productSlug, args.url)) return true;
  if (
    catalogImageUrlHasConflictingVariant({
      url: args.url,
      cardName: args.cardName,
      productSlug: args.productSlug,
      issuer: args.issuer,
    })
  ) {
    return false;
  }
  if (
    catalogImageUrlAllowedForPersist({
      url: args.url,
      productSlug: args.productSlug,
      issuer: args.issuer,
      cardName: args.cardName,
      title: args.title,
    })
  ) {
    return true;
  }
  if (
    isProdstaticCardArtUrl(args.url) &&
    catalogImageSearchTitleMatchesCard({
      title: args.title,
      cardName: args.cardName,
      issuer: args.issuer,
    }) &&
    !catalogImageSearchTitleConflictsWithCard({
      title: args.title,
      cardName: args.cardName,
      issuer: args.issuer,
      productSlug: args.productSlug,
    })
  ) {
    return true;
  }
  if (args.searchRank > 8) return false;
  if (isIssuerHostedImageUrl(args.url)) {
    return catalogImageIsIssuerCardArtPath(args.url, args.productSlug);
  }

  const blob = `${args.url} ${args.title}`.toLowerCase();
  const issuerWord = args.issuer
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)[0];
  if (issuerWord && issuerWord.length >= 3 && blob.includes(issuerWord)) {
    return true;
  }
  const nameTokens = args.cardName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !["card", "visa", "bank"].includes(t));
  const hits = nameTokens.filter((t) => blob.includes(t)).length;
  return hits >= Math.min(2, nameTokens.length);
}

/** Gate before writing `catalogCardImageBlob` (curated URLs bypass tail rules). */
export function catalogImageUrlAllowedForPersist(args: {
  url: string;
  productSlug: string;
  issuer: string;
  cardName: string;
  title?: string;
}): boolean {
  if (isMarketingBannerImagePath(args.url)) return false;
  if (isCuratedCatalogImageUrl(args.productSlug, args.url)) return true;
  if (catalogImageUrlHasConflictingVariant(args)) return false;
  if (catalogImageUrlMatchesProductSlug(args)) return true;
  if (
    args.title?.trim() &&
    isProdstaticCardArtUrl(args.url) &&
    catalogImageSearchTitleMatchesCard({
      title: args.title,
      cardName: args.cardName,
      issuer: args.issuer,
    }) &&
    !catalogImageSearchTitleConflictsWithCard({
      title: args.title,
      cardName: args.cardName,
      issuer: args.issuer,
      productSlug: args.productSlug,
    })
  ) {
    return true;
  }
  return false;
}
