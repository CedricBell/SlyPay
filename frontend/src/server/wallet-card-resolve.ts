import { inferIssuerAndProductNameDetailed } from "@/server/catalog-infer";
import {
  findBestSafelistIssuerInText,
  isSafelistIssuer,
  stripSafelistIssuerFromQuery,
} from "@/server/issuer-safelist";

export type ResolvedUserCardInput = {
  name: string;
  issuer: string;
  /** Canonical safelist label when matched. */
  safelistIssuer: string | null;
  trustedIssuer: boolean;
};

/**
 * Parse free-text card input: infer product name + map issuer to the trusted safelist when possible.
 */
export function resolveUserCardInput(rawQuery: string): ResolvedUserCardInput | null {
  const q = rawQuery.trim();
  if (q.length < 2) return null;

  const safelistFromQuery = findBestSafelistIssuerInText(q);
  const detailed = inferIssuerAndProductNameDetailed(q);

  if (detailed) {
    const safelistIssuer =
      findBestSafelistIssuerInText(detailed.issuer) ?? safelistFromQuery;
    const trusted = Boolean(
      safelistIssuer ||
        isSafelistIssuer(detailed.issuer) ||
        findBestSafelistIssuerInText(q),
    );
    return {
      name: detailed.name.trim() || q,
      issuer: detailed.issuer.trim(),
      safelistIssuer,
      trustedIssuer: trusted,
    };
  }

  if (safelistFromQuery) {
    const name = stripSafelistIssuerFromQuery(q, safelistFromQuery);
    const shortIssuer = titleCaseIssuerLabel(safelistFromQuery);
    return {
      name: name.length >= 2 ? name : q,
      issuer: shortIssuer,
      safelistIssuer: safelistFromQuery,
      trustedIssuer: true,
    };
  }

  return {
    name: q,
    issuer: "Unknown issuer",
    safelistIssuer: null,
    trustedIssuer: false,
  };
}

function titleCaseIssuerLabel(canonical: string): string {
  const lower = canonical.toLowerCase();
  if (lower.includes("jpmorgan chase") || lower.startsWith("chase")) return "Chase";
  if (lower.includes("american express") || lower.startsWith("amex")) {
    return "American Express";
  }
  if (lower.includes("capital one")) return "Capital One";
  if (lower.includes("wells fargo")) return "Wells Fargo";
  if (lower.includes("bank of america")) return "Bank of America";
  if (lower.includes("citi") || lower.includes("citibank")) return "Citi";
  if (lower.includes("discover")) return "Discover";
  if (lower.includes("ally")) return "Ally Bank";
  if (lower.includes("us bank") || lower.includes("u.s. bank")) return "US Bank";
  return canonical
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Intel / ad-hoc catalog when issuer maps to the trusted safelist. */
export function isTrustedIssuerQuery(rawQuery: string): boolean {
  const resolved = resolveUserCardInput(rawQuery);
  return resolved?.trustedIssuer === true;
}
