import { prisma } from "@/lib/prisma";
import {
  normalizeIssuer,
  resolveIssuerOfficialHosts,
} from "@/server/card-intelligence/issuer-official-domains";
import { isPlaceholderIssuerForOpenSearch } from "@/server/card-intelligence/pdf-discovery-query";

/**
 * Static issuer → official domains map, plus any domains learned from successful
 * PDF intel (`KnownIssuer`) for that display label.
 */
export async function resolveIssuerOfficialHostsWithDb(
  issuerRaw: string,
): Promise<string[]> {
  const staticHosts = resolveIssuerOfficialHosts(issuerRaw);
  if (staticHosts.length > 0) return staticHosts;
  if (isPlaceholderIssuerForOpenSearch(issuerRaw)) return [];

  const needle = normalizeIssuer(issuerRaw);
  if (!needle) return [];

  const rows = await prisma.knownIssuer.findMany({
    take: 500,
    orderBy: { lastSeenAt: "desc" },
  });
  const hosts = new Set<string>();
  for (const r of rows) {
    if (normalizeIssuer(r.displayName) === needle) {
      hosts.add(r.apexDomain);
    }
  }
  return [...hosts];
}
