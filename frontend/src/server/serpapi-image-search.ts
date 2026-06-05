/**
 * Google Images via SerpAPI — primary card-art discovery (engine=google_images).
 * https://serpapi.com/google-images-api
 */

const SERPAPI_SEARCH_ENDPOINT = "https://serpapi.com/search.json";

const JUNK_IMAGE_PATH =
  /(poster|print|framed|mockup|wall-art|merchandise|t-shirt|sticker|emoji|icon-|favicon|sprite|1x1|pixel\.gif|wp-content\/uploads|benefits-\d|blog\/)/i;

const JUNK_HOST =
  /(ebay\.|etsy\.com|pinterest\.|reddit\.com|facebook\.com|instagram\.com)/i;

export type SerpApiImageHit = {
  url: string;
  title: string;
  rank: number;
  source?: string;
  width?: number;
  height?: number;
};

type SerpApiImageRow = {
  position?: number;
  original?: string;
  title?: string;
  source?: string;
  original_width?: number;
  original_height?: number;
  unsafe?: boolean;
};

type SerpApiImageResponse = {
  images_results?: SerpApiImageRow[];
  error?: string;
};

export function serpApiImageSearchEnabled(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

function serpApiKey(): string | null {
  return process.env.SERPAPI_API_KEY?.trim() || null;
}

/** https image URLs suitable for card-art download attempts. */
export function isSerpApiImageCandidate(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    if (u.hostname.includes("serpapi.com")) return false;
    const path = u.pathname.toLowerCase();
    if (JUNK_IMAGE_PATH.test(path) || JUNK_HOST.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Google Images results for one query (preserves SerpAPI result order).
 */
export async function fetchSerpApiImageHits(
  query: string,
  opts?: { num?: number },
): Promise<SerpApiImageHit[]> {
  const apiKey = serpApiKey();
  const q = query.trim();
  if (!apiKey || q.length < 2) return [];

  const endpoint = new URL(SERPAPI_SEARCH_ENDPOINT);
  endpoint.searchParams.set("engine", "google_images");
  endpoint.searchParams.set("q", q);
  endpoint.searchParams.set("api_key", apiKey);
  endpoint.searchParams.set("google_domain", "google.com");
  endpoint.searchParams.set("gl", "us");
  endpoint.searchParams.set("hl", "en");
  endpoint.searchParams.set("num", String(Math.min(Math.max(opts?.num ?? 20, 1), 40)));

  try {
    const res = await fetch(endpoint.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as SerpApiImageResponse;
    if (data.error) return [];

    const out: SerpApiImageHit[] = [];
    for (const row of data.images_results ?? []) {
      if (row.unsafe) continue;
      const url = row.original?.trim();
      if (!url || !isSerpApiImageCandidate(url)) continue;
      const rank = Math.max(0, (row.position ?? out.length + 1) - 1);
      out.push({
        url,
        title: (row.title ?? row.source ?? "").trim(),
        rank,
        source: row.source,
        width: row.original_width,
        height: row.original_height,
      });
    }
    return out;
  } catch {
    return [];
  }
}
