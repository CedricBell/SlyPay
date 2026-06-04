/**
 * Card art discovery via Brave Image Search (and optional Google CSE image mode).
 * Used when issuer DAM URLs return bot-wall HTML instead of real images.
 */

const BRAVE_IMAGE_ENDPOINT = "https://api.search.brave.com/res/v1/images/search";

type BraveImageResult = {
  title?: string;
  properties?: { url?: string; width?: number; height?: number };
  thumbnail?: { src?: string };
  meta_url?: { hostname?: string };
  confidence?: string;
};

type BraveImageResponse = {
  results?: BraveImageResult[];
};

type GoogleCseImageItem = { link?: string; title?: string };
type GoogleCseImageResponse = { items?: GoogleCseImageItem[] };

const JUNK_IMAGE_PATH =
  /(poster|print|framed|mockup|wall-art|merchandise|t-shirt|sticker|emoji|icon-|favicon|sprite|1x1|pixel\.gif|wp-content\/uploads|benefits-\d|blog\/)/i;

const JUNK_HOST = /(amazon\.com|ebay\.|etsy\.com|pinterest\.|reddit\.com)/i;

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyDirectCardImageUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    const path = u.pathname.toLowerCase();
    if (JUNK_IMAGE_PATH.test(path) || JUNK_HOST.test(u.hostname)) return false;
    if (/\.(png|jpe?g|webp)(\?|$)/i.test(path)) return true;
    if (
      /(card-art|card_art|jpmc-marketplace\/card|\/cards\/|card-front|platinum-metal)/i.test(
        path,
      )
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function scoreSearchImageHit(
  url: string,
  title: string,
  args: { issuer: string; cardName: string },
): number {
  const issuerN = normalizeKey(args.issuer);
  const nameN = normalizeKey(args.cardName);
  const titleN = normalizeKey(title);
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  let score = 0;
  if (host.includes("americanexpress.com")) score += 80;
  if (host.includes("creditcards.chase.com") || host.includes("capitalone.com")) {
    score += 70;
  }
  if (host.includes("creditcards.com") || host.includes("prodstatic.com")) {
    score += 55;
  }
  if (issuerN && host.includes(issuerN.split(" ")[0] ?? "")) score += 25;

  for (const term of nameN.split(" ").filter((t) => t.length > 2)) {
    if (titleN.includes(term)) score += 12;
    if (url.toLowerCase().includes(term)) score += 8;
  }
  if (/card\s*art|credit\s*card|metal\s*card|platinum-metal/i.test(titleN)) {
    score += 30;
  }
  if (/\.png(\?|$)/i.test(url)) score += 15;
  if (JUNK_IMAGE_PATH.test(titleN) || JUNK_IMAGE_PATH.test(url)) score -= 120;
  if (/\/shared\/images\/cards\//i.test(url)) score += 40;

  return score;
}

async function fetchBraveImageUrls(query: string): Promise<
  Array<{ url: string; title: string }>
> {
  const token =
    process.env.BRAVE_SEARCH_API_KEY?.trim() ||
    process.env.BRAVE_API_KEY?.trim();
  if (!token) return [];

  const endpoint = new URL(BRAVE_IMAGE_ENDPOINT);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("count", "20");

  try {
    const res = await fetch(endpoint.toString(), {
      method: "GET",
      headers: { "X-Subscription-Token": token },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as BraveImageResponse;
    const out: Array<{ url: string; title: string }> = [];
    for (const row of data.results ?? []) {
      const url = row.properties?.url?.trim();
      if (!url || !isLikelyDirectCardImageUrl(url)) continue;
      out.push({ url, title: row.title ?? "" });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchGoogleImageUrls(query: string): Promise<
  Array<{ url: string; title: string }>
> {
  const key = process.env.GOOGLE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_ID?.trim();
  if (!key || !cx) return [];

  const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("cx", cx);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("searchType", "image");
  endpoint.searchParams.set("num", "10");
  endpoint.searchParams.set("safe", "active");

  try {
    const res = await fetch(endpoint.toString(), {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as GoogleCseImageResponse;
    return (data.items ?? [])
      .map((i) => ({ url: i.link?.trim() ?? "", title: i.title ?? "" }))
      .filter(
        (x): x is { url: string; title: string } =>
          Boolean(x.url) && isLikelyDirectCardImageUrl(x.url),
      );
  } catch {
    return [];
  }
}

/** Ranked https image URLs from Brave / Google image search. */
export async function discoverCatalogCardImageViaImageSearch(args: {
  issuer: string;
  cardName: string;
  productSlug?: string;
}): Promise<string[]> {
  const issuer = args.issuer.trim();
  const cardName = args.cardName.trim();
  if (!cardName) return [];

  const issuerHost =
    /american express/i.test(issuer)
      ? "americanexpress.com"
      : /chase/i.test(issuer)
        ? "creditcards.chase.com"
        : /capital one/i.test(issuer)
          ? "capitalone.com"
          : null;

  const queries = [
    `${issuer} ${cardName} credit card official card art png`,
    issuerHost ? `site:${issuerHost} ${cardName} card art png` : null,
    `${cardName} credit card png site:creditcards.com OR site:americanexpress.com`,
  ].filter((q): q is string => Boolean(q));

  const scored = new Map<string, number>();

  for (const q of queries) {
    const braveHits = await fetchBraveImageUrls(q);
    const googleHits = await fetchGoogleImageUrls(q);
    for (const hit of [...braveHits, ...googleHits]) {
      const prev = scored.get(hit.url) ?? -1;
      const next = scoreSearchImageHit(hit.url, hit.title, { issuer, cardName });
      if (next > prev) scored.set(hit.url, next);
    }
  }

  return [...scored.entries()]
    .filter(([, s]) => s >= 20)
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url);
}
