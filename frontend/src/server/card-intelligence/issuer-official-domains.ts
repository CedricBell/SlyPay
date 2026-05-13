/**
 * Primary issuer domains used to constrain web discovery (PDF URLs must live on these hosts).
 * Extend as you add regions/products — keep aligned with `CardCatalogProduct.issuer` strings.
 */
const NORMALIZED_TO_HOSTS = new Map<string, string[]>([
  ["american express", ["americanexpress.com"]],
  ["amex", ["americanexpress.com"]],
  ["chase", ["chase.com"]],
  ["citi", ["citi.com", "online.citi.com"]],
  ["capital one", ["capitalone.com"]],
  ["discover", ["discover.com"]],
  ["wells fargo", ["wellsfargo.com"]],
  ["bank of america", ["bankofamerica.com"]],
  ["bofa", ["bankofamerica.com"]],
  ["us bank", ["usbank.com"]],
  ["u s bank", ["usbank.com"]],
  ["barclays", ["barclaysus.com"]],
  ["goldman sachs", ["goldmansachs.com"]],
  ["apple card", ["goldmansachs.com"]],
  ["synchrony", ["synchrony.com"]],
  ["td bank", ["td.com"]],
]);

export function normalizeIssuer(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns apex hosts (e.g. chase.com) for HTTPS URL allowlisting. */
export function resolveIssuerOfficialHosts(issuerRaw: string): string[] {
  const key = normalizeIssuer(issuerRaw);
  if (!key) return [];
  if (NORMALIZED_TO_HOSTS.has(key)) {
    return NORMALIZED_TO_HOSTS.get(key) ?? [];
  }
  for (const [needle, hosts] of NORMALIZED_TO_HOSTS) {
    if (key.includes(needle)) return hosts;
  }
  return [];
}

export function hostnameMatchesIssuer(host: string, issuerHosts: string[]): boolean {
  const h = host.toLowerCase();
  return issuerHosts.some((apex) => h === apex || h.endsWith(`.${apex}`));
}
