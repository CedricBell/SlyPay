import { guessIssuerApexDomainsFromDisplayName } from "@/server/card-intelligence/issuer-domain-guess";
import {
  normalizeIssuer,
  resolveIssuerOfficialHosts,
} from "@/server/card-intelligence/issuer-official-domains";

/** Where card marketing / terms pages actually live (often subdomains). */
const EXTRA_ORIGINS_BY_ISSUER = new Map<string, string[]>([
  [
    "chase",
    [
      "https://creditcards.chase.com",
      "https://sites.chase.com",
    ],
  ],
  [
    "american express",
    ["https://www.americanexpress.com", "https://www.americanexpress.com/en-us"],
  ],
  ["amex", ["https://www.americanexpress.com", "https://www.americanexpress.com/en-us"]],
  ["capital one", ["https://www.capitalone.com", "https://creditcards.capitalone.com"]],
  ["citi", ["https://www.citi.com", "https://online.citi.com"]],
  ["discover", ["https://www.discover.com", "https://www.discover.com/credit-cards"]],
  ["wells fargo", ["https://www.wellsfargo.com", "https://creditcards.wellsfargo.com"]],
  ["bank of america", ["https://www.bankofamerica.com"]],
  ["bofa", ["https://www.bankofamerica.com"]],
]);

/**
 * Base URLs to crawl (subdomains + apex). `hostnameMatchesIssuer` still uses apex hosts.
 */
export function resolveIssuerCrawlOrigins(issuerRaw: string): string[] {
  const key = normalizeIssuer(issuerRaw);
  const out = new Set<string>();

  const extras =
    EXTRA_ORIGINS_BY_ISSUER.get(key) ??
    [...EXTRA_ORIGINS_BY_ISSUER.entries()].find(([needle]) =>
      key.includes(needle),
    )?.[1] ??
    [];

  for (const u of extras) out.add(u.replace(/\/$/, ""));

  const apexHosts = new Set([
    ...resolveIssuerOfficialHosts(issuerRaw),
    ...guessIssuerApexDomainsFromDisplayName(issuerRaw),
  ]);
  for (const apex of apexHosts) {
    out.add(`https://www.${apex}`);
    out.add(`https://${apex}`);
  }

  return [...out];
}
