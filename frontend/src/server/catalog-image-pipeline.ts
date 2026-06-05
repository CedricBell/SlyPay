/**
 * Card image pipeline — independent from rewards/intel extraction.
 *
 * Priority:
 * 1. Curated issuer DAM URLs
 * 2. Issuer DAM path guesses (high-trust)
 * 3. SerpAPI Google Images — human query (`"Issuer Card" credit card`)
 * 4. SerpAPI multi-query ranked search (prodstatic, site:issuer, …)
 * 5. Prodstatic-focused SerpAPI pass (title-verified)
 * 5. Broader DAM guesses + product-page scrape
 */

import { CURATED_CATALOG_IMAGE_URLS } from "@/server/card-catalog.entries";
import { prisma } from "@/lib/prisma";
import {
  catalogCardImageApiPath,
  isCatalogCardImageApiPath,
} from "@/lib/catalog-image-paths";
import { downloadCatalogCardImage } from "@/server/catalog-card-image-download";
import {
  discoverCatalogCardImageHumanFirst,
  discoverCatalogCardImageViaImageSearch,
  discoverProdstaticCardImage,
  serpApiImageSearchEnabled,
  type HumanImageSearchHit,
} from "@/server/catalog-card-image-search";
import { guessBuiltInCardArtUrls } from "@/server/catalog-image-resolve";
import {
  catalogImageIsIssuerExactPath,
  catalogImageUrlAllowedForHumanSearchPersist,
  catalogImageSearchTitleConflictsWithCard,
  catalogImageUrlAllowedForPersist,
  isCuratedCatalogImageUrl,
  isMarketingBannerImagePath,
  scoreCatalogImageUrl,
} from "@/server/catalog-image-match";
import { isPlaceholderImageUrl } from "@/server/catalog-card-art";

export { catalogCardImageApiPath, isCatalogCardImageApiPath };

export type CatalogImageJobStage =
  | "cached"
  | "curated"
  | "issuer-dam"
  | "serpapi-human"
  | "serpapi-ranked"
  | "prodstatic"
  | "scrape";

export type CatalogImageJobResult = {
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  imageUrl: string | null;
  sourceUrl: string | null;
  stage: CatalogImageJobStage | null;
  errorMessage?: string;
};

type DownloadCandidate = {
  sourceUrl: string;
  title: string;
  searchRank: number;
  pathScore: number;
  buffer: Buffer;
  mimeType: string;
  byteSize: number;
};

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
      data: {
        imageUrl: catalogCardImageApiPath(args.productSlug, new Date()),
      },
    }),
  ]);
}

function pathScoreForUrl(args: {
  url: string;
  title: string;
  productSlug: string;
  issuer: string;
  cardName: string;
  searchRank: number;
}): number {
  return scoreCatalogImageUrl({
    url: args.url,
    hint: args.title,
    cardName: args.cardName,
    productSlug: args.productSlug,
    issuer: args.issuer,
    resultIndex: args.searchRank,
  });
}

async function tryDownloadCandidate(args: {
  productSlug: string;
  sourceUrl: string;
  issuer: string;
  cardName: string;
  title?: string;
  searchRank?: number;
  strictSlugMatch?: boolean;
}): Promise<DownloadCandidate | null> {
  const title = args.title ?? "";
  const searchRank = args.searchRank ?? 0;
  if (
    args.title?.trim() &&
    catalogImageSearchTitleConflictsWithCard({
      title: args.title,
      cardName: args.cardName,
      issuer: args.issuer,
      productSlug: args.productSlug,
    })
  ) {
    return null;
  }

  const allowed = args.strictSlugMatch
    ? catalogImageUrlAllowedForPersist({
        url: args.sourceUrl,
        productSlug: args.productSlug,
        issuer: args.issuer,
        cardName: args.cardName,
        title: args.title,
      })
    : catalogImageUrlAllowedForHumanSearchPersist({
        url: args.sourceUrl,
        title,
        productSlug: args.productSlug,
        issuer: args.issuer,
        cardName: args.cardName,
        searchRank,
      });
  if (!allowed || isMarketingBannerImagePath(args.sourceUrl)) return null;

  const downloaded = await downloadCatalogCardImage(args.sourceUrl);
  if (!downloaded) return null;

  const pathScore = pathScoreForUrl({
    url: args.sourceUrl,
    title,
    productSlug: args.productSlug,
    issuer: args.issuer,
    cardName: args.cardName,
    searchRank,
  });
  if (pathScore < 0) return null;

  return {
    sourceUrl: args.sourceUrl,
    title,
    searchRank,
    pathScore,
    buffer: downloaded.buffer,
    mimeType: downloaded.mimeType,
    byteSize: downloaded.byteSize,
  };
}

/** Download all viable candidates, persist the highest path score (not first OK). */
async function tryBestFromCandidates(args: {
  productSlug: string;
  issuer: string;
  cardName: string;
  stage: CatalogImageJobStage;
  items: Array<{
    url: string;
    title?: string;
    rank?: number;
    strictSlugMatch?: boolean;
  }>;
}): Promise<CatalogImageJobResult | null> {
  const downloaded: DownloadCandidate[] = [];

  for (const item of args.items) {
    const candidate = await tryDownloadCandidate({
      productSlug: args.productSlug,
      sourceUrl: item.url,
      issuer: args.issuer,
      cardName: args.cardName,
      title: item.title ?? "",
      searchRank: item.rank ?? 0,
      strictSlugMatch: item.strictSlugMatch ?? false,
    });
    if (candidate) downloaded.push(candidate);
  }

  if (!downloaded.length) return null;

  downloaded.sort((a, b) => b.pathScore - a.pathScore || a.searchRank - b.searchRank);
  const best = downloaded[0]!;

  await persistDownloadedImage({
    productSlug: args.productSlug,
    sourceUrl: best.sourceUrl,
    buffer: best.buffer,
    mimeType: best.mimeType,
    byteSize: best.byteSize,
  });

  return {
    status: "COMPLETED",
    imageUrl: catalogCardImageApiPath(args.productSlug),
    sourceUrl: best.sourceUrl,
    stage: args.stage,
  };
}

async function tryUrlsStrict(args: {
  productSlug: string;
  issuer: string;
  cardName: string;
  urls: string[];
  stage: CatalogImageJobStage;
}): Promise<CatalogImageJobResult | null> {
  return tryBestFromCandidates({
    productSlug: args.productSlug,
    issuer: args.issuer,
    cardName: args.cardName,
    stage: args.stage,
    items: args.urls.map((url) => ({ url, strictSlugMatch: true })),
  });
}

function isHighTrustCatalogImageUrl(url: string, productSlug: string): boolean {
  return (
    isCuratedCatalogImageUrl(productSlug, url) ||
    catalogImageIsIssuerExactPath(url, productSlug)
  );
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
  return out;
}

/**
 * Resolves and stores card art for one catalog product.
 * Does not read intel PDFs, reward extracts, or official document URLs.
 */
export async function runCatalogImageJob(args: {
  productSlug: string;
  issuer: string;
  cardName?: string;
  forceRefresh?: boolean;
}): Promise<CatalogImageJobResult> {
  const slug = args.productSlug.trim();
  if (!slug) {
    return {
      status: "FAILED",
      imageUrl: null,
      sourceUrl: null,
      stage: null,
      errorMessage: "Missing product slug",
    };
  }

  const cardName = args.cardName?.trim() || slug.replace(/-/g, " ");
  const issuer = args.issuer.trim();

  const existing = await prisma.catalogCardImageBlob.findUnique({
    where: { productSlug: slug },
    select: { sourceUrl: true },
  });

  if (existing && !args.forceRefresh) {
    return {
      status: "COMPLETED",
      imageUrl: catalogCardImageApiPath(slug),
      sourceUrl: existing.sourceUrl,
      stage: "cached",
    };
  }

  try {
    const curated = CURATED_CATALOG_IMAGE_URLS[slug]?.trim();
    if (curated) {
      const hit = await tryUrlsStrict({
        productSlug: slug,
        issuer,
        cardName,
        urls: [curated],
        stage: "curated",
      });
      if (hit) return hit;
    }

    const issuerDamTrusted = guessBuiltInCardArtUrls({
      productSlug: slug,
      issuer,
      cardName,
    }).filter((u) => isHighTrustCatalogImageUrl(u, slug));
    const damHit = await tryUrlsStrict({
      productSlug: slug,
      issuer,
      cardName,
      urls: issuerDamTrusted,
      stage: "issuer-dam",
    });
    if (damHit) return damHit;

    if (serpApiImageSearchEnabled()) {
      const humanHits = await discoverCatalogCardImageHumanFirst({
        issuer,
        cardName,
        productSlug: slug,
      });
      const humanHit = await tryBestFromCandidates({
        productSlug: slug,
        issuer,
        cardName,
        stage: "serpapi-human",
        items: humanHits.slice(0, 20).map((hit: HumanImageSearchHit) => ({
          url: hit.url,
          title: hit.title,
          rank: hit.rank,
          strictSlugMatch: false,
        })),
      });
      if (humanHit) return humanHit;

      const rankedSearch = await discoverCatalogCardImageViaImageSearch({
        issuer,
        cardName,
        productSlug: slug,
      });
      const rankedHit = await tryBestFromCandidates({
        productSlug: slug,
        issuer,
        cardName,
        stage: "serpapi-ranked",
        items: rankedSearch.map((hit) => ({
          url: hit.url,
          title: hit.title,
          rank: hit.rank,
          strictSlugMatch: false,
        })),
      });
      if (rankedHit) return rankedHit;

      const prodstaticHits = await discoverProdstaticCardImage({
        issuer,
        cardName,
      });
      const prodstaticHit = await tryBestFromCandidates({
        productSlug: slug,
        issuer,
        cardName,
        stage: "prodstatic",
        items: prodstaticHits.map((hit) => ({
          url: hit.url,
          title: hit.title,
          rank: hit.rank,
          strictSlugMatch: false,
        })),
      });
      if (prodstaticHit) return prodstaticHit;
    }

    const allDam = uniqueUrls(
      guessBuiltInCardArtUrls({ productSlug: slug, issuer, cardName }),
    );
    const allDamHit = await tryUrlsStrict({
      productSlug: slug,
      issuer,
      cardName,
      urls: allDam,
      stage: "issuer-dam",
    });
    if (allDamHit) return allDamHit;

    const { discoverCatalogCardImageFromOfficialPages } = await import(
      "@/server/card-intelligence/extract-catalog-card-image"
    );
    const scraped = await discoverCatalogCardImageFromOfficialPages({
      productSlug: slug,
      issuer,
      cardName,
      officialDocumentUrl: null,
      documentUrl: null,
    }).catch(() => null);
    if (scraped) {
      const scrapeHit = await tryUrlsStrict({
        productSlug: slug,
        issuer,
        cardName,
        urls: [scraped],
        stage: "scrape",
      });
      if (scrapeHit) return scrapeHit;
    }

    if (existing) {
      return {
        status: "COMPLETED",
        imageUrl: catalogCardImageApiPath(slug),
        sourceUrl: existing.sourceUrl,
        stage: "cached",
      };
    }

    return {
      status: "SKIPPED",
      imageUrl: null,
      sourceUrl: null,
      stage: null,
      errorMessage: serpApiImageSearchEnabled()
        ? "No downloadable card image found"
        : "SERPAPI_API_KEY not configured — set it in .env to enable image search",
    };
  } catch (e) {
    return {
      status: "FAILED",
      imageUrl: null,
      sourceUrl: null,
      stage: null,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}
