import { hostnameMatchesIssuer } from "@/server/card-intelligence/issuer-official-domains";
import { fetchIssuerHtml } from "@/server/card-intelligence/issuer-html-links";
import { guessIssuerProductPageUrls } from "@/server/card-intelligence/issuer-product-url-guess";
import {
  guessCoBrandMarketingUrls,
  guessRetailerProductPageUrls,
  resolveIntelDiscoveryHosts,
} from "@/server/card-intelligence/co-brand-discovery";
import { isPlaceholderImageUrl } from "@/server/catalog-card-art";
import {
  catalogImageUrlHasConflictingVariant,
  catalogImageUrlMatchesProductSlug,
} from "@/server/catalog-image-match";
import { scoreCatalogImageUrl } from "@/server/catalog-image-match";

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
  context?: {
    productSlug: string;
    cardName: string;
    issuer: string;
  },
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
    if (context) {
      if (
        catalogImageUrlHasConflictingVariant({
          url: raw,
          cardName: context.cardName,
          productSlug: context.productSlug,
          issuer: context.issuer,
        })
      ) {
        continue;
      }
    }
    let s = scoreCardImageUrl(raw);
    if (context) {
      s += scoreCatalogImageUrl({
        url: raw,
        cardName: context.cardName,
        productSlug: context.productSlug,
        issuer: context.issuer,
      });
    }
    if (s < 10) continue;
    const prev = scored.get(raw) ?? -Infinity;
    if (s > prev) scored.set(raw, s);
  }
  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]);
  for (const [url] of ranked) {
    if (!context) return url;
    if (
      catalogImageUrlMatchesProductSlug({
        url,
        productSlug: context.productSlug,
        issuer: context.issuer,
      })
    ) {
      return url;
    }
  }
  return ranked[0]?.[0];
}

async function discoverFromPageUrl(
  pageUrl: string,
  hosts: string[],
  context: {
    productSlug: string;
    cardName: string;
    issuer: string;
  },
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
  return pickBestImage(candidates, hosts, context);
}

/**
 * Scrapes official issuer product / terms HTML for card art (og:image, card-art assets).
 */
export async function discoverCatalogCardImageFromOfficialPages(args: {
  productSlug: string;
  issuer: string;
  cardName?: string;
  officialDocumentUrl?: string | null;
  documentUrl?: string | null;
}): Promise<string | undefined> {
  const cardName =
    args.cardName?.trim() || args.productSlug.replace(/-/g, " ");
  const discovery = await resolveIntelDiscoveryHosts(
    args.issuer,
    cardName,
    args.productSlug,
  );
  const hosts = discovery.hosts;
  if (!hosts.length) return undefined;

  const context = {
    productSlug: args.productSlug,
    cardName: discovery.cardNameForDiscovery,
    issuer: discovery.issuerForDiscovery,
  };

  const pages = new Set<string>();
  for (const u of guessIssuerProductPageUrls(
    discovery.issuerForDiscovery,
    args.productSlug,
    discovery.cardNameForDiscovery,
  )) {
    pages.add(u);
  }
  if (discovery.coBrand) {
    for (const u of guessCoBrandMarketingUrls(discovery.coBrand)) {
      pages.add(u);
    }
    for (const u of guessRetailerProductPageUrls(
      args.productSlug,
      discovery.coBrand,
    )) {
      pages.add(u);
    }
  }
  if (args.officialDocumentUrl) pages.add(args.officialDocumentUrl);
  if (args.documentUrl) pages.add(args.documentUrl);

  let best: { url: string; score: number } | null = null;

  for (const page of pages) {
    try {
      const path = new URL(page).pathname.toLowerCase();
      if (path.endsWith(".pdf")) continue;
      if (
        catalogImageUrlHasConflictingVariant({
          url: page,
          cardName,
          productSlug: args.productSlug,
          issuer: args.issuer,
        })
      ) {
        continue;
      }
    } catch {
      continue;
    }
    const found = await discoverFromPageUrl(page, hosts, context);
    if (!found || isPlaceholderImageUrl(found)) continue;
    const score = scoreCatalogImageUrl({
      url: found,
      cardName,
      productSlug: args.productSlug,
      issuer: args.issuer,
    });
    if (!best || score > best.score) best = { url: found, score };
  }
  return best?.url;
}

