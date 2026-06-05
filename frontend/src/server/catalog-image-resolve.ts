import {
  CURATED_CATALOG_IMAGE_URLS,
} from "@/server/card-catalog.entries";
import { guessAmexProductPageUrlsFromCardName } from "@/server/card-intelligence/issuer-product-url-guess";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import {
  isPlaceholderImageUrl,
  resolveCatalogImageUrl,
  resolveCatalogImageUrlByIssuerAndName,
} from "@/server/catalog-card-art";
import { downloadCatalogCardImage } from "@/server/catalog-card-image-download";
import { discoverCatalogCardImageViaImageSearch } from "@/server/catalog-card-image-search";
import { catalogImageUrlAllowedForPersist } from "@/server/catalog-image-match";

/** Chase marketplace PNG from slug tail (e.g. sapphire-preferred). */
function guessChaseDamArtUrl(productSlug: string): string | undefined {
  const tail = productSlug.replace(/^chase-/, "");
  if (!tail || !productSlug.startsWith("chase-")) return undefined;
  const file = tail.replace(/\//g, "-");
  return `https://creditcards.chase.com/content/dam/jpmc-marketplace/card-${file}/card-${file}.png`;
}

/** Amex DAM art from marketing card path segment. */
function guessAmexDamArtUrl(
  productSlug: string,
  cardName?: string,
): string | undefined {
  for (const pageUrl of cardName
    ? guessAmexProductPageUrlsFromCardName(cardName)
    : []) {
    const m = pageUrl.match(/\/card\/([^/]+)\/?$/i);
    if (!m?.[1]) continue;
    const seg = m[1];
    const damName = seg === "platinum" ? "platinum-card" : `${seg}`;
    if (seg.endsWith("-card")) {
      return `https://www.americanexpress.com/content/dam/amex/us/en/credit-cards/card-art/consumer/${seg}/${seg}-480x304.png`;
    }
    return `https://www.americanexpress.com/content/dam/amex/us/en/credit-cards/card-art/consumer/${damName}/${damName}-480x304.png`;
  }
  const tail = productSlug.replace(/^amex-/, "").replace(/-/g, "-");
  if (productSlug === "amex-platinum") {
    return "https://www.americanexpress.com/en-us/account/get-started/platinum/images/platinum-metal.png";
  }
  return undefined;
}

/** Deterministic issuer CDN URLs (no HTML scrape). */
export function guessBuiltInCardArtUrls(args: {
  productSlug: string;
  issuer: string;
  cardName?: string;
}): string[] {
  const urls: string[] = [];
  const fromMap = CURATED_CATALOG_IMAGE_URLS[args.productSlug];
  if (fromMap) urls.push(fromMap);
  const curated = resolveCatalogImageUrl(args.productSlug);
  if (curated) urls.push(curated);
  const isKnownCatalogSlug = CARD_CATALOG_ENTRIES.some(
    (e) => e.id === args.productSlug,
  );
  if (!isKnownCatalogSlug && args.cardName) {
    const byName = resolveCatalogImageUrlByIssuerAndName(
      args.issuer,
      args.cardName,
    );
    if (byName) urls.push(byName);
  }
  const chase = guessChaseDamArtUrl(args.productSlug);
  if (chase) urls.push(chase);
  const amex = guessAmexDamArtUrl(args.productSlug, args.cardName);
  if (amex) urls.push(amex);
  return [...new Set(urls.filter((u) => !isPlaceholderImageUrl(u)))];
}

/** True when the URL returns real image bytes (not Amex HTML bot walls). */
export async function validateCatalogImageUrl(url: string): Promise<boolean> {
  return (await downloadCatalogCardImage(url)) !== null;
}

/** First candidate that actually downloads as an image. */
export async function resolveWorkingCatalogImageUrl(args: {
  productSlug: string;
  issuer: string;
  cardName?: string;
  scraped?: string | null;
}): Promise<string | null> {
  const cardName =
    args.cardName?.trim() || args.productSlug.replace(/-/g, " ");
  const candidates = [
    ...guessBuiltInCardArtUrls(args),
    args.scraped,
    ...(await discoverCatalogCardImageViaImageSearch({
      issuer: args.issuer,
      cardName,
      productSlug: args.productSlug,
    })).map((h) => h.url),
  ].filter((u): u is string => Boolean(u?.trim()) && !isPlaceholderImageUrl(u));

  const seen = new Set<string>();
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    if (
      !catalogImageUrlAllowedForPersist({
        url,
        productSlug: args.productSlug,
        issuer: args.issuer,
        cardName,
      })
    ) {
      continue;
    }
    if (await validateCatalogImageUrl(url)) return url;
  }
  return null;
}
