import { sha256Hex } from "@/server/canonical-hash";

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

/**
 * Best-effort split of a free-text query into issuer + product name for ad-hoc
 * catalog rows and PDF discovery. Unknown banks still return a usable pair.
 */
export function inferIssuerAndProductName(query: string): {
  issuer: string;
  name: string;
} | null {
  const q = query.trim();
  if (q.length < 3) return null;

  for (const rule of PREFIX_RULES) {
    if (rule.pattern.test(q)) {
      const rest = q.replace(rule.pattern, "").trim();
      const name = cleanCardProductName(rest.length ? rest : q);
      if (name.length < 1) return { issuer: rule.issuer, name: cleanCardProductName(q) };
      return { issuer: rule.issuer, name };
    }
  }

  return { issuer: "Unknown issuer", name: cleanCardProductName(q) };
}

/** Deterministic slug for user-typed cards (not in the static catalog file). */
export function stableAdHocCatalogSlug(issuer: string, name: string): string {
  const k = `${normalizeKey(issuer)}|${normalizeKey(name)}`;
  return `adhoc-${sha256Hex(k).slice(0, 24)}`;
}
