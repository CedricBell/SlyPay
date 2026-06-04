import { isCatalogCardImageApiPath } from "@/lib/catalog-image-paths";

/**
 * Some issuer CDNs block hotlinking in the browser; serve those via our proxy.
 */
const DISPLAY_PROXY_HOST =
  /(americanexpress\.com|creditcards\.chase\.com|\.chase\.com|citibank\.com|\.citi\.com|wellsfargo\.com|bankofamerica\.com|discover\.com|usbank\.com)/i;

export function catalogImageSrcForDisplay(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  if (isCatalogCardImageApiPath(url)) return url.trim();
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return url.trim();
    // Issuer CDNs block browsers and often return HTML to bots — use DB blob API only.
    if (DISPLAY_PROXY_HOST.test(u.hostname)) {
      return null;
    }
    return u.toString();
  } catch {
    return url.trim();
  }
}
