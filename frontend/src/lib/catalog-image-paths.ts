export function catalogCardImageApiPath(productSlug: string): string {
  return `/api/v1/catalog-card-images/${encodeURIComponent(productSlug)}`;
}

export function isCatalogCardImageApiPath(
  url: string | null | undefined,
): boolean {
  if (!url?.trim()) return false;
  return url.trim().startsWith("/api/v1/catalog-card-images/");
}
