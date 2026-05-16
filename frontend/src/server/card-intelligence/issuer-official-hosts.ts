import { prisma } from "@/lib/prisma";
import {
  normalizeIssuer,
  resolveIssuerOfficialHosts,
} from "@/server/card-intelligence/issuer-official-domains";
import { guessIssuerApexDomainsFromDisplayName } from "@/server/card-intelligence/issuer-domain-guess";
import { isPlaceholderIssuerForOpenSearch } from "@/server/card-intelligence/pdf-discovery-query";

/**
 * Static issuer → official domains map, plus any domains learned from successful
 * PDF intel (`KnownIssuer`) for that display label.
 */
export async function resolveIssuerOfficialHostsWithDb(
  issuerRaw: string,
): Promise<string[]> {
  const hosts = new Set<string>(resolveIssuerOfficialHosts(issuerRaw));
  for (const g of guessIssuerApexDomainsFromDisplayName(issuerRaw)) {
    hosts.add(g);
  }

  if (!isPlaceholderIssuerForOpenSearch(issuerRaw)) {
    const needle = normalizeIssuer(issuerRaw);
    if (needle) {
      const rows = await prisma.knownIssuer.findMany({
        take: 500,
        orderBy: { lastSeenAt: "desc" },
      });
      for (const r of rows) {
        if (normalizeIssuer(r.displayName) === needle) {
          hosts.add(r.apexDomain);
        }
      }
    }
  }

  return [...hosts];
}
