import { sha256Hex } from "@/server/canonical-hash";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { isPlaceholderIssuerForOpenSearch } from "@/server/card-intelligence/pdf-discovery-query";

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip marketing suffixes (e.g. Double UpSM) for cleaner PDF search. */
export function cleanCardProductName(raw: string): string {
  return raw
    .replace(/\s*SM\s*/gi, " ")
    .replace(/\s*TM\s*/gi, " ")
    .replace(/\u2122/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type PrefixRule = { pattern: RegExp; issuer: string };

/**
 * Longest-match first: more specific patterns must appear before shorter ones
 * (e.g. "bank of america" before "bofa").
 */
const PREFIX_RULES: PrefixRule[] = [
  { pattern: /^american\s+express\s+/i, issuer: "American Express" },
  { pattern: /^amex\s+/i, issuer: "American Express" },
  { pattern: /^bank\s+of\s+america\s+/i, issuer: "Bank of America" },
  { pattern: /^bofa\s+/i, issuer: "Bank of America" },
  { pattern: /^capital\s+one\s+/i, issuer: "Capital One" },
  { pattern: /^wells\s+fargo\s+/i, issuer: "Wells Fargo" },
  { pattern: /^u\s*s\s*bank\s+/i, issuer: "US Bank" },
  { pattern: /^us\s+bank\s+/i, issuer: "US Bank" },
  { pattern: /^goldman\s+sachs\s+/i, issuer: "Goldman Sachs" },
  { pattern: /^apple\s+card\s+/i, issuer: "Apple Card" },
  { pattern: /^apple\s+/i, issuer: "Apple Card" },
  { pattern: /^synchrony\s+/i, issuer: "Synchrony" },
  { pattern: /^barclays\s+/i, issuer: "Barclays" },
  { pattern: /^discover\s+/i, issuer: "Discover" },
  { pattern: /^citi\s+/i, issuer: "Citi" },
  { pattern: /^chase\s+/i, issuer: "Chase" },
  { pattern: /^td\s+bank\s+/i, issuer: "TD Bank" },
  { pattern: /^td\s+/i, issuer: "TD Bank" },
  { pattern: /^rbc\s+royal\s+bank\s+/i, issuer: "RBC" },
  { pattern: /^rbc\s+/i, issuer: "RBC" },
  { pattern: /^scotiabank\s+/i, issuer: "Scotiabank" },
  { pattern: /^bmo\s+/i, issuer: "BMO" },
  { pattern: /^pnc\s+/i, issuer: "PNC" },
  { pattern: /^truist\s+/i, issuer: "Truist" },
];

/** Issuer at end of string: "Gold Card American Express". */
const SUFFIX_RULES: PrefixRule[] = [
  { pattern: /\s+american\s+express\s*$/i, issuer: "American Express" },
  { pattern: /\s+amex\s*$/i, issuer: "American Express" },
  { pattern: /\s+bank\s+of\s+america\s*$/i, issuer: "Bank of America" },
  { pattern: /\s+bofa\s*$/i, issuer: "Bank of America" },
  { pattern: /\s+capital\s+one\s*$/i, issuer: "Capital One" },
  { pattern: /\s+wells\s+fargo\s*$/i, issuer: "Wells Fargo" },
  { pattern: /\s+discover\s*$/i, issuer: "Discover" },
  { pattern: /\s+chase\s*$/i, issuer: "Chase" },
  { pattern: /\s+citi\s*$/i, issuer: "Citi" },
  { pattern: /\s+barclays\s*$/i, issuer: "Barclays" },
];

const CATALOG_ISSUERS = [...new Set(CARD_CATALOG_ENTRIES.map((e) => e.issuer))].sort(
  (a, b) => b.length - a.length,
);

function inferFromCatalogIssuerEmbed(q: string): { issuer: string; name: string } | null {
  const nq = normalizeKey(q);
  for (const issuer of CATALOG_ISSUERS) {
    const nk = normalizeKey(issuer);
    if (nk.length < 3 || !nq.includes(nk)) continue;
    const re = new RegExp(
      issuer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    const rest = q.replace(re, " ").replace(/\s+/g, " ").trim();
    const name = cleanCardProductName(rest);
    if (name.length >= 1) return { issuer, name };
    return { issuer, name: cleanCardProductName(q) };
  }
  return null;
}

export type CatalogInferMethod =
  | "prefix"
  | "suffix"
  | "catalog_embed"
  | "unknown_brand"
  | "unknown_issuer";

export type InferredCardIdentity = {
  issuer: string;
  name: string;
  method: CatalogInferMethod;
};

/**
 * Best-effort split of a free-text query into issuer + product name.
 * Stops before inventing issuers from gibberish (no unknown-brand / unknown-issuer).
 */
export function inferIssuerAndProductNameDetailed(
  query: string,
): InferredCardIdentity | null {
  const q = query.trim();
  if (q.length < 3) return null;

  for (const rule of PREFIX_RULES) {
    if (rule.pattern.test(q)) {
      const rest = q.replace(rule.pattern, "").trim();
      const name = cleanCardProductName(rest.length ? rest : q);
      if (name.length < 1) {
        return {
          issuer: rule.issuer,
          name: cleanCardProductName(q),
          method: "prefix",
        };
      }
      return { issuer: rule.issuer, name, method: "prefix" };
    }
  }

  for (const rule of SUFFIX_RULES) {
    if (rule.pattern.test(q)) {
      const rest = q.replace(rule.pattern, "").trim();
      const name = cleanCardProductName(rest.length ? rest : q);
      if (name.length < 1) {
        return {
          issuer: rule.issuer,
          name: cleanCardProductName(q),
          method: "suffix",
        };
      }
      return { issuer: rule.issuer, name, method: "suffix" };
    }
  }

  const embedded = inferFromCatalogIssuerEmbed(q);
  if (embedded) {
    return { ...embedded, method: "catalog_embed" };
  }

  const unknownBrand = inferFromUnknownBrandQuery(q);
  if (unknownBrand) {
    return { ...unknownBrand, method: "unknown_brand" };
  }

  return null;
}

/**
 * Legacy helper — still used to repair placeholder issuers during intel jobs.
 * May fall back to "Unknown issuer" when the query cannot be parsed.
 */
export function inferIssuerAndProductName(query: string): {
  issuer: string;
  name: string;
} | null {
  const detailed = inferIssuerAndProductNameDetailed(query);
  if (detailed) {
    return { issuer: detailed.issuer, name: detailed.name };
  }
  const q = query.trim();
  if (q.length < 3) return null;
  return { issuer: "Unknown issuer", name: cleanCardProductName(q) };
}

const UNKNOWN_BRAND_STOPWORDS = new Set([
  "card",
  "cards",
  "credit",
  "visa",
  "mastercard",
  "debit",
  "the",
  "a",
  "an",
  "and",
  "or",
  "member",
  "membership",
]);

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Free-text queries like "robinhood gold card" → issuer Robinhood, product Gold.
 */
function inferFromUnknownBrandQuery(q: string): { issuer: string; name: string } | null {
  const tokens = normalizeKey(q)
    .split(" ")
    .filter((t) => t.length > 0 && !UNKNOWN_BRAND_STOPWORDS.has(t));

  if (tokens.length === 0) return null;

  if (tokens.length === 1) {
    const brand = titleCaseWords(tokens[0]!);
    return { issuer: brand, name: `${brand} Card` };
  }

  const issuer = titleCaseWords(tokens[0]!);
  const name = titleCaseWords(tokens.slice(1).join(" "));
  if (!name.length) return { issuer, name: `${issuer} Card` };
  return { issuer, name };
}

/**
 * When the DB still has a placeholder issuer, re-split from the stored product name.
 */
export function resolveIntelIssuerAndCardName(
  issuer: string,
  cardName: string,
): { issuer: string; cardName: string; corrected: boolean } {
  if (!isPlaceholderIssuerForOpenSearch(issuer)) {
    return { issuer: issuer.trim(), cardName: cardName.trim(), corrected: false };
  }

  const inferred = inferIssuerAndProductName(cardName.trim());
  if (!inferred || isPlaceholderIssuerForOpenSearch(inferred.issuer)) {
    return { issuer: issuer.trim(), cardName: cardName.trim(), corrected: false };
  }

  return {
    issuer: inferred.issuer,
    cardName: inferred.name,
    corrected: true,
  };
}

/** Deterministic slug for user-typed cards (not in the static catalog file). */
export function stableAdHocCatalogSlug(issuer: string, name: string): string {
  const k = `${normalizeKey(issuer)}|${normalizeKey(name)}`;
  return `adhoc-${sha256Hex(k).slice(0, 24)}`;
}
