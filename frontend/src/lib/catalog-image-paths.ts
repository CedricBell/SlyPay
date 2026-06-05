export function catalogCardImageApiPath(
  productSlug: string,
  cacheBust?: string | number | Date,
): string {
  const base = `/api/v1/catalog-card-images/${encodeURIComponent(productSlug)}`;
  if (cacheBust == null) return base;
  const v =
    cacheBust instanceof Date
      ? cacheBust.getTime()
      : typeof cacheBust === "number"
        ? cacheBust
        : cacheBust.trim();
  return `${base}?v=${encodeURIComponent(String(v))}`;
}

export function isCatalogCardImageApiPath(
  url: string | null | undefined,
): boolean {
  if (!url?.trim()) return false;
  const path = url.trim().split("?")[0] ?? "";
  return path.startsWith("/api/v1/catalog-card-images/");
}

export function catalogCardImageSlugFromApiPath(
  url: string | null | undefined,
): string | null {
  if (!isCatalogCardImageApiPath(url)) return null;
  const path = (url ?? "").trim().split("?")[0] ?? "";
  const m = path.match(/^\/api\/v1\/catalog-card-images\/(.+)$/);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}
