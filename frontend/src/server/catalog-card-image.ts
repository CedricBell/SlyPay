import {
  catalogCardImageApiPath,
  isCatalogCardImageApiPath,
} from "@/lib/catalog-image-paths";
import { prisma } from "@/lib/prisma";
import { isPlaceholderImageUrl } from "@/server/catalog-card-art";
import { downloadCatalogCardImage } from "@/server/catalog-card-image-download";
import { discoverCatalogCardImageViaImageSearch } from "@/server/catalog-card-image-search";
import { guessBuiltInCardArtUrls } from "@/server/catalog-image-resolve";

export { catalogCardImageApiPath, isCatalogCardImageApiPath };

async function persistDownloadedImage(args: {
  productSlug: string;
  sourceUrl: string;
  buffer: Buffer;
  mimeType: string;
  byteSize: number;
}): Promise<void> {
  await prisma.$transaction([
    prisma.catalogCardImageBlob.upsert({
      where: { productSlug: args.productSlug },
      create: {
        productSlug: args.productSlug,
        mimeType: args.mimeType,
        byteSize: args.byteSize,
        sourceUrl: args.sourceUrl,
        data: args.buffer,
      },
      update: {
        mimeType: args.mimeType,
        byteSize: args.byteSize,
        sourceUrl: args.sourceUrl,
        data: args.buffer,
        fetchedAt: new Date(),
      },
    }),
    prisma.cardCatalogProduct.update({
      where: { slug: args.productSlug },
      data: { imageUrl: catalogCardImageApiPath(args.productSlug) },
    }),
  ]);
}

async function tryDownloadAndPersist(args: {
  productSlug: string;
  sourceUrl: string;
}): Promise<boolean> {
  const downloaded = await downloadCatalogCardImage(args.sourceUrl);
  if (!downloaded) return false;
  await persistDownloadedImage({
    productSlug: args.productSlug,
    sourceUrl: args.sourceUrl,
    buffer: downloaded.buffer,
    mimeType: downloaded.mimeType,
    byteSize: downloaded.byteSize,
  });
  return true;
}

function candidatePriority(url: string): number {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host.includes("americanexpress.com") && path.includes("platinum-metal")) {
      return 0;
    }
    if (host.includes("newsroom") || path.includes("/benefits/")) return 8;
    if (
      host.includes("americanexpress.com") ||
      host.includes("creditcards.chase.com") ||
      host.includes("ecm.capitalone.com")
    ) {
      return 1;
    }
    if (
      host.includes("prodstatic.com") &&
      path.includes("/shared/images/cards/")
    ) {
      return 2;
    }
    if (/wp-content\/uploads|benefits/i.test(path)) return 9;
    return 5;
  } catch {
    return 10;
  }
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = raw?.trim();
    if (!u || isPlaceholderImageUrl(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out.sort((a, b) => candidatePriority(a) - candidatePriority(b));
}

/** Collects candidate image URLs: curated, scrape, then Brave/Google image search. */
export async function collectCatalogCardImageCandidates(args: {
  productSlug: string;
  issuer: string;
  cardName?: string;
  scraped?: string | null;
}): Promise<string[]> {
  const cardName = args.cardName?.trim() || args.productSlug.replace(/-/g, " ");

  const { discoverCatalogCardImageFromOfficialPages } = await import(
    "@/server/card-intelligence/extract-catalog-card-image"
  );

  const scraped =
    args.scraped ??
    (await discoverCatalogCardImageFromOfficialPages({
      productSlug: args.productSlug,
      issuer: args.issuer,
      officialDocumentUrl: null,
      documentUrl: null,
    }).catch(() => undefined));

  const searchHits = await discoverCatalogCardImageViaImageSearch({
    issuer: args.issuer,
    cardName,
    productSlug: args.productSlug,
  });

  return uniqueUrls([
    ...guessBuiltInCardArtUrls({
      productSlug: args.productSlug,
      issuer: args.issuer,
      cardName: args.cardName,
    }),
    scraped,
    ...searchHits,
  ]);
}

/**
 * Resolves card art, downloads from the web (issuer CDN or image search), stores in Postgres.
 * Returns internal API path when stored; null if nothing could be downloaded (avoids 502 proxy loops).
 */
export async function resolveAndPersistCatalogImage(args: {
  productSlug: string;
  issuer: string;
  cardName?: string;
  currentImageUrl?: string | null;
  officialDocumentUrl?: string | null;
  documentUrl?: string | null;
  forceRefresh?: boolean;
}): Promise<string | null> {
  const slug = args.productSlug.trim();
  if (!slug) return null;

  const existing = await prisma.catalogCardImageBlob.findUnique({
    where: { productSlug: slug },
    select: { sourceUrl: true },
  });

  if (existing && !args.forceRefresh) {
    return catalogCardImageApiPath(slug);
  }

  const { discoverCatalogCardImageFromOfficialPages } = await import(
    "@/server/card-intelligence/extract-catalog-card-image"
  );

  const scraped = await discoverCatalogCardImageFromOfficialPages({
    productSlug: slug,
    issuer: args.issuer,
    officialDocumentUrl: args.officialDocumentUrl,
    documentUrl: args.documentUrl,
  });

  const candidates = await collectCatalogCardImageCandidates({
    productSlug: slug,
    issuer: args.issuer,
    cardName: args.cardName,
    scraped,
  });

  for (const sourceUrl of candidates) {
    if (existing?.sourceUrl === sourceUrl && !args.forceRefresh) {
      return catalogCardImageApiPath(slug);
    }
    if (await tryDownloadAndPersist({ productSlug: slug, sourceUrl })) {
      return catalogCardImageApiPath(slug);
    }
  }

  return existing ? catalogCardImageApiPath(slug) : null;
}
