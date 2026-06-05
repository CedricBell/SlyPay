import {
  catalogCardImageApiPath,
  isCatalogCardImageApiPath,
  runCatalogImageJob,
} from "@/server/catalog-image-pipeline";

export { catalogCardImageApiPath, isCatalogCardImageApiPath };

/** @deprecated Use `collectCatalogCardImageCandidates` only for debugging. */
export async function collectCatalogCardImageCandidates(args: {
  productSlug: string;
  issuer: string;
  cardName?: string;
  scraped?: string | null;
}): Promise<string[]> {
  const { discoverCatalogCardImageViaImageSearch } = await import(
    "@/server/catalog-card-image-search"
  );
  const { guessBuiltInCardArtUrls } = await import(
    "@/server/catalog-image-resolve"
  );
  const cardName = args.cardName?.trim() || args.productSlug.replace(/-/g, " ");
  const searchHits = await discoverCatalogCardImageViaImageSearch({
    issuer: args.issuer,
    cardName,
    productSlug: args.productSlug,
  });
  return [
    ...guessBuiltInCardArtUrls({
      productSlug: args.productSlug,
      issuer: args.issuer,
      cardName: args.cardName,
    }),
    args.scraped,
    ...searchHits.map((h) => h.url),
  ].filter((u): u is string => Boolean(u?.trim()));
}

/**
 * Resolves card art via the dedicated image pipeline (not intel).
 * `officialDocumentUrl` / `documentUrl` are ignored — kept for call-site compatibility.
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
  const result = await runCatalogImageJob({
    productSlug: args.productSlug,
    issuer: args.issuer,
    cardName: args.cardName,
    forceRefresh: args.forceRefresh,
  });
  return result.imageUrl;
}
