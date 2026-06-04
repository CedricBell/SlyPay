import { hostnameMatchesIssuer } from "@/server/card-intelligence/issuer-official-domains";
import { fetchIssuerHtml } from "@/server/card-intelligence/issuer-html-links";
import { guessIssuerProductPageUrls } from "@/server/card-intelligence/issuer-product-url-guess";
import { resolveIssuerOfficialHostsWithDb } from "@/server/card-intelligence/issuer-official-hosts";
import { isPlaceholderImageUrl } from "@/server/catalog-card-art";

const CARD_ART_PATH =
  /(card[-_]?art|card-art|jpmc-marketplace\/card|content\/dam\/.*card|\/card\/.*\.(png|jpe?g|webp))/i;

const BAD_IMAGE_PATH =
  /(favicon|sprite|icon|logo|pixel|1x1|avatar|badge|arrow|chevron|social|facebook|twitter\.com|svg)/i;

function normalizeImageSrc(raw: string, base: URL): string | null {
  try {
    const u = new URL(raw.trim(), base);
    if (u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function scoreCardImageUrl(url: string): number {
  const path = url.toLowerCase();
  if (BAD_IMAGE_PATH.test(path)) return -100;
  if (!/\.(png|jpe?g|webp)(\?|$)/i.test(path) && !CARD_ART_PATH.test(path)) {
    return -20;
  }
  let score = 0;
  if (CARD_ART_PATH.test(path)) score += 120;
  if (/og:image|card-art|card_art/i.test(path)) score += 40;
  if (/\.png(\?|$)/i.test(path)) score += 25;
  if (/\.webp(\?|$)/i.test(path)) score += 15;
  if (/480x|600x|800x|card-front|card_front/i.test(path)) score += 20;
  if (/placehold\.co/i.test(path)) return -200;
  return score;
}

function extractMetaImage(html: string, base: URL): string[] {
  const urls: string[] = [];
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const resolved = normalizeImageSrc(m[1], base);
      if (resolved) urls.push(resolved);
    }
  }
  return urls;
}

function extractImgTagUrls(html: string, base: URL): string[] {
  const urls: string[] = [];
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const resolved = normalizeImageSrc(m[1], base);
    if (resolved) urls.push(resolved);
  }
  return urls;
}

function pickBestImage(
  candidates: string[],
  hosts: string[],
): string | undefined {
  const scored = new Map<string, number>();
  for (const raw of candidates) {
    let host: string;
    try {
      host = new URL(raw).hostname;
    } catch {
      continue;
    }
    if (!hostnameMatchesIssuer(host, hosts)) continue;
    const s = scoreCardImageUrl(raw);
    if (s < 10) continue;
    const prev = scored.get(raw) ?? -Infinity;
    if (s > prev) scored.set(raw, s);
  }
  const best = [...scored.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0];
}

async function discoverFromPageUrl(
  pageUrl: string,
  hosts: string[],
): Promise<string | undefined> {
  const html = await fetchIssuerHtml(pageUrl);
  if (!html) return undefined;
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return undefined;
  }
  const candidates = [
    ...extractMetaImage(html, base),
    ...extractImgTagUrls(html, base),
  ];
  return pickBestImage(candidates, hosts);
}

/**
 * Scrapes official issuer product / terms HTML for card art (og:image, card-art assets).
 */
export async function discoverCatalogCardImageFromOfficialPages(args: {
  productSlug: string;
  issuer: string;
  officialDocumentUrl?: string | null;
  documentUrl?: string | null;
}): Promise<string | undefined> {
  const hosts = await resolveIssuerOfficialHostsWithDb(args.issuer);
  if (!hosts.length) return undefined;

  const pages = new Set<string>();
  for (const u of guessIssuerProductPageUrls(
    args.issuer,
    args.productSlug,
  )) {
    pages.add(u);
  }
  if (args.officialDocumentUrl) pages.add(args.officialDocumentUrl);
  if (args.documentUrl) pages.add(args.documentUrl);

  for (const page of pages) {
    try {
      const path = new URL(page).pathname.toLowerCase();
      if (path.endsWith(".pdf")) continue;
    } catch {
      continue;
    }
    const found = await discoverFromPageUrl(page, hosts);
    if (found && !isPlaceholderImageUrl(found)) return found;
  }
  return undefined;
}

