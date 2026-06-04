import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { isAncillaryIssuerFeaturePath } from "@/server/card-intelligence/intel-path-bonus";

const PRODUCT_STOPWORDS = new Set([
  "card",
  "cards",
  "credit",
  "the",
  "a",
  "an",
  "and",
  "or",
  "visa",
  "mastercard",
  "member",
  "membership",
  "bank",
]);

/**
 * Meaningful product tokens for search + scoring (drops generic words like "Card").
 */
export function coreCardQueryPhrase(cardName: string): string | null {
  const words = cardName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !PRODUCT_STOPWORDS.has(w));
  if (words.length >= 2) return words.join(" ");
  if (words.length === 1) return words[0] ?? null;
  return null;
}

/** Tier / variant tokens in PDF titles — penalized when missing from the user's card name. */
const VARIANT_TIER_TOKENS = [
  "surpass",
  "aspire",
  "behold",
  "strata",
  "reserve",
  "infinite",
  "signature",
  "premier",
  "schwab",
  "morgan",
  "secured",
  "student",
  "optimum",
];

function issuerWordProtections(issuer: string | undefined): Set<string> {
  if (!issuer?.trim()) return new Set();
  return new Set(
    issuer
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );
}

function variantTokensAbsentFromCardName(
  cardName: string,
  issuer?: string,
): string[] {
  const cn = cardName.toLowerCase();
  const protectedW = issuerWordProtections(issuer);
  return VARIANT_TIER_TOKENS.filter((t) => {
    if (protectedW.has(t)) return false;
    return !new RegExp(`\\b${escapeRegExp(t)}\\b`).test(cn);
  });
}

/**
 * Other catalog products from the same issuer whose slug extends the current
 * slug (e.g. `discover-it` vs `discover-it-miles`) → use their extra segment(s)
 * as search exclusions and PDF ranking penalties so we don't pick the wrong variant.
 */
export function siblingSlugExclusionTerms(
  issuer: string,
  currentSlug: string,
): string[] {
  const prefix = `${currentSlug}-`;
  const terms = new Set<string>();
  for (const e of CARD_CATALOG_ENTRIES) {
    if (e.issuer !== issuer || e.id === currentSlug) continue;
    if (e.id.startsWith(prefix)) {
      const rest = e.id.slice(prefix.length);
      for (const part of rest.split("-")) {
        if (part.length >= 3) terms.add(part.toLowerCase());
      }
    }
  }
  return [...terms];
}

/**
 * Search intent for official card intel: PDF **or** HTML (many issuers publish
 * terms only on the web — e.g. `/apply/terms/...` — and `filetype:pdf` would hide them).
 */
const INTEL_DOC_HUMAN_INTENT =
  "(terms OR benefits OR rewards OR agreement OR disclosure OR cardmember OR guide OR schumer OR \"fee table\")";

export function buildIssuerScopedSearchQuery(args: {
  hosts: string[];
  cardName: string;
  exclusionTerms: string[];
  /** Extra site: operators (e.g. creditcards.chase.com when apex is chase.com). */
  extraSiteHosts?: string[];
}): string {
  const allHosts = [...new Set([...args.hosts, ...(args.extraSiteHosts ?? [])])];
  const siteClause = allHosts.map((h) => `site:${h}`).join(" OR ");
  const core = coreCardQueryPhrase(args.cardName);
  const fallback = args.cardName.replace(/"/g, " ").trim();
  const phrase =
    core && core.length > 0
      ? `"${core}"`
      : fallback.length > 0
        ? `"${fallback}"`
        : "";
  const neg = args.exclusionTerms
    .filter((t) => t.length >= 3)
    .map((t) => `-${t}`)
    .join(" ");
  const junkNeg =
    "-free-credit-score -features-benefits -mycreditguide -unifiedlandingpage -cardmember-agreements -company/legal";
  return [
    `(${siteClause})`,
    phrase,
    '"credit card"',
    INTEL_DOC_HUMAN_INTENT,
    neg,
    junkNeg,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIssuerQueryKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Issuer labels that should not constrain the open-web search query. */
export function isPlaceholderIssuerForOpenSearch(issuer: string): boolean {
  const k = normalizeIssuerQueryKey(issuer);
  return (
    k.length === 0 ||
    k === "unknown issuer" ||
    k === "unknown" ||
    k === "other" ||
    k === "other issuer"
  );
}

/**
 * Web search without `site:` — used when the issuer is not mapped to official
 * domains. Document-oriented keywords; pairing issuer+name when meaningful.
 */
export function buildOpenWebSearchQuery(args: {
  issuer: string;
  cardName: string;
  exclusionTerms: string[];
}): string {
  const useIssuer = !isPlaceholderIssuerForOpenSearch(args.issuer);
  const nameCore = coreCardQueryPhrase(args.cardName) ?? args.cardName.trim();
  const combined = (
    useIssuer ? `${args.issuer} ${nameCore}` : nameCore
  )
    .replace(/"/g, " ")
    .trim()
    .slice(0, 160);
  const phrase = combined.length ? `"${combined}"` : "";
  const neg = args.exclusionTerms
    .filter((t) => t.length >= 3)
    .map((t) => `-${t}`)
    .join(" ");
  return [phrase, INTEL_DOC_HUMAN_INTENT, neg]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Prefer URLs (and search snippets) that align with the catalog slug / name,
 * and penalize sibling-variant tokens (e.g. "miles" for `discover-it`).
 */
export function scorePdfCandidate(args: {
  url: string;
  hint: string;
  cardName: string;
  productSlug: string;
  exclusionTerms: string[];
  /** Issuer label — protects words like "express" from false variant penalties. */
  issuer?: string;
  /** Original search rank (0 = first); small tie-breaker toward engine order. */
  resultIndex: number;
}): number {
  const href = args.url.toLowerCase();
  const hint = args.hint.toLowerCase();
  const blob = `${href} ${hint}`;
  const slug = args.productSlug.toLowerCase();
  const slugTokens = slug.split("-").filter((t) => t.length > 1);

  let s = 0;
  const slugCompact = slug.replace(/-/g, "");
  const pathLetters = href.replace(/[^a-z0-9]/gi, "");
  if (slugCompact.length >= 4 && pathLetters.includes(slugCompact)) {
    s += 45;
  }
  for (const t of slugTokens) {
    if (blob.includes(t)) s += 14;
  }

  const corePhrase = coreCardQueryPhrase(args.cardName);
  if (corePhrase && blob.includes(corePhrase)) {
    s += 38;
  }

  const nameWords = args.cardName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2 && !PRODUCT_STOPWORDS.has(w));
  for (const w of nameWords) {
    if (blob.includes(w)) s += 10;
  }

  for (const tier of variantTokensAbsentFromCardName(
    args.cardName,
    args.issuer,
  )) {
    const re = new RegExp(`\\b${escapeRegExp(tier)}\\b`, "i");
    if (re.test(blob)) s -= 78;
  }

  for (const ex of args.exclusionTerms) {
    const exl = ex.toLowerCase();
    if (slug.includes(exl)) continue;
    if (exl.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegExp(exl)}\\b`, "i");
    if (re.test(blob)) s -= 85;
  }

  s += Math.max(0, 40 - args.resultIndex);

  try {
    const u = new URL(args.url);
    if (isAncillaryIssuerFeaturePath(u.pathname + u.search)) {
      s -= 140;
    }
    if (
      /\/credit-cards\/card\/[^/]+\/?$/i.test(u.pathname) &&
      /americanexpress\.com/i.test(u.hostname)
    ) {
      s += 85;
    }
  } catch {
    /* */
  }

  return s;
}
