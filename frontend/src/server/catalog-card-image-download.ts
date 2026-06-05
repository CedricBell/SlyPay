import { isPlaceholderImageUrl } from "@/server/catalog-card-art";

export const MAX_CATALOG_IMAGE_BYTES = 2 * 1024 * 1024;

/** Issuer CDNs + trusted card-art hosts from image search. */
export const TRUSTED_CARD_ART_HOST =
  /(americanexpress\.com|creditcards\.chase\.com|creditcards\.com|\.chase\.com|citibank\.com|\.citi\.com|wellsfargo\.com|bankofamerica\.com|discover\.com|usbank\.com|capitalone\.com|ecm\.capitalone\.com|apple\.com|biltrewards\.com|static\.biltrewards\.com|prodstatic\.com|macys\.com|amazon\.com|target\.com|costco\.com|walmart\.com|lowes\.com|nordstrom\.com|kohls\.com|homedepot\.com|bestbuy\.com|bloomingdales\.com|rei\.com|wayfair\.com|synchrony\.com|mysynchrony\.com|paypal\.com|gap\.com|oldnavy\.com|barclays\.com|barclaycardus\.com)/i;

export function isTrustedCardArtHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (TRUSTED_CARD_ART_HOST.test(h)) return true;
  return false;
}

export function isImageBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return true;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 64).toString("ascii").toLowerCase();
    if (brand.includes("avif") || brand.includes("avis")) return true;
  }
  return false;
}

function normalizeImageMime(
  contentType: string | null,
  url: string,
): string {
  const ct = (contentType ?? "").split(";")[0]?.trim().toLowerCase();
  if (ct?.includes("avif")) return "image/avif";
  if (ct?.startsWith("image/")) return ct;
  const path = url.toLowerCase();
  if (path.includes(".webp")) return "image/webp";
  if (path.includes(".jpg") || path.includes(".jpeg")) return "image/jpeg";
  return "image/png";
}

/** True when response body is a real image (Amex often returns HTML with 200). */
export function isImageResponse(
  contentType: string | null,
  body: Buffer,
): boolean {
  if (!isImageBytes(body)) return false;
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("text/plain")) return false;
  return true;
}

/** Downloads card art from a trusted https host (server-side). */
export async function downloadCatalogCardImage(
  sourceUrl: string,
): Promise<{ buffer: Buffer; mimeType: string; byteSize: number } | null> {
  let target: URL;
  try {
    target = new URL(sourceUrl.trim());
  } catch {
    return null;
  }

  if (
    target.protocol !== "https:" ||
    !isTrustedCardArtHostname(target.hostname) ||
    isPlaceholderImageUrl(sourceUrl)
  ) {
    return null;
  }

  try {
    const res = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/png,image/jpeg,image/webp,image/*,*/*;q=0.8",
        Referer: `${target.origin}/`,
      },
    });

    if (!res.ok) return null;

    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length < 64 || raw.length > MAX_CATALOG_IMAGE_BYTES) return null;
    if (!isImageResponse(res.headers.get("content-type"), raw)) return null;

    return {
      buffer: raw,
      mimeType: normalizeImageMime(res.headers.get("content-type"), target.toString()),
      byteSize: raw.length,
    };
  } catch {
    return null;
  }
}
