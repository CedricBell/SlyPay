/**
 * Hostnames allowed for optional editorial HTML fetched into the card intel pipeline.
 * Keep this list tiny to limit SSRF / abuse; expand deliberately when needed.
 */
const EDITORIAL_INTEL_HOSTS = new Set(
  [
    "thepointsguy.com",
    "www.thepointsguy.com",
    "nerdwallet.com",
    "www.nerdwallet.com",
    "creditcards.nerdwallet.com",
  ].map((h) => h.toLowerCase()),
);

export function isEditorialIntelHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (EDITORIAL_INTEL_HOSTS.has(h)) return true;
  return false;
}

/** Same https / anti-local rules as generic document fetch, plus editorial host allowlist. */
export function assertEditorialSupplementUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Invalid editorial supplement URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Editorial supplements must use https://");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    throw new Error("Local hosts are not allowed");
  }
  if (!isEditorialIntelHost(host)) {
    throw new Error(
      `Editorial URL host not allowed: ${host}. Allowed: thepointsguy.com, nerdwallet.com (incl. creditcards.nerdwallet.com, www).`,
    );
  }
  return url;
}
