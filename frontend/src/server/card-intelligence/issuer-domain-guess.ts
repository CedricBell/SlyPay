import {
  normalizeIssuer,
  resolveIssuerOfficialHosts,
} from "@/server/card-intelligence/issuer-official-domains";
import { isPlaceholderIssuerForOpenSearch } from "@/server/card-intelligence/pdf-discovery-query";

/**
 * Best-effort apex domain(s) for an issuer display name (e.g. Robinhood → robinhood.com).
 * Used when the static issuer map has no entry — enables site crawl + site: search.
 */
export function guessIssuerApexDomainsFromDisplayName(issuerRaw: string): string[] {
  if (isPlaceholderIssuerForOpenSearch(issuerRaw)) return [];

  const key = normalizeIssuer(issuerRaw);
  if (!key || key.length < 2) return [];

  const out = new Set<string>();

  const compact = key.replace(/\s+/g, "");
  if (compact.length >= 2 && compact.length <= 40) {
    out.add(`${compact}.com`);
  }

  const parts = key.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const joined = parts.join("");
    if (joined.length >= 3 && joined.length <= 40) {
      out.add(`${joined}.com`);
    }
  }

  return [...out];
}

/** True when discovery hosts come only from heuristics, not the static bank map. */
export function issuerUsesOnlyGuessedDomains(
  issuerRaw: string,
  resolvedHosts: string[],
): boolean {
  if (!resolvedHosts.length) return false;
  if (resolveIssuerOfficialHosts(issuerRaw).length > 0) return false;
  return guessIssuerApexDomainsFromDisplayName(issuerRaw).length > 0;
}
