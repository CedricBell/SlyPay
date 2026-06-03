/** Public origin for absolute URLs (catalog PDFs, auth redirects). */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export function catalogDocumentPublicUrl(slug: string): string {
  return `${getAppBaseUrl()}/api/v1/catalog-documents/${encodeURIComponent(slug)}`;
}
