export type WebSearchHit = { url: string; hint: string };

type BraveWebResult = { url?: string; title?: string; description?: string };
type BraveWebResponse = {
  web?: { results?: BraveWebResult[] };
};

type GoogleCseItem = { link?: string; title?: string; snippet?: string };
type GoogleCseResponse = { items?: GoogleCseItem[] };

export function braveSearchConfigured(): boolean {
  return Boolean(
    process.env.BRAVE_SEARCH_API_KEY?.trim() ||
      process.env.BRAVE_API_KEY?.trim(),
  );
}

export function googleCseConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_API_KEY?.trim() && process.env.GOOGLE_CSE_ID?.trim(),
  );
}

export function webSearchConfigured(): boolean {
  return braveSearchConfigured() || googleCseConfigured();
}

/** Open-web fallback defaults ON when a search API exists; set `INTEL_ALLOW_OPEN_WEB=0` to disable. */
export function openWebDiscoveryEnabled(): boolean {
  if (!webSearchConfigured()) return false;
  const v = process.env.INTEL_ALLOW_OPEN_WEB?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return true;
}

async function fetchBraveHits(searchQuery: string): Promise<WebSearchHit[]> {
  const token =
    process.env.BRAVE_SEARCH_API_KEY?.trim() ||
    process.env.BRAVE_API_KEY?.trim();
  if (!token) return [];

  const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
  endpoint.searchParams.set("q", searchQuery);
  endpoint.searchParams.set("count", "20");

  const res = await fetch(endpoint.toString(), {
    method: "GET",
    headers: { "X-Subscription-Token": token },
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Brave Search failed: HTTP ${res.status} ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as BraveWebResponse;
  return (data.web?.results ?? [])
    .map((r) => ({
      url: r.url,
      hint: [r.title, r.description].filter(Boolean).join(" "),
    }))
    .filter((x): x is WebSearchHit => Boolean(x.url));
}

async function fetchGoogleHits(searchQuery: string): Promise<WebSearchHit[]> {
  const key = process.env.GOOGLE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_ID?.trim();
  if (!key || !cx) return [];

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("num", "10");

  const res = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Google CSE failed: HTTP ${res.status} ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as GoogleCseResponse;
  return (data.items ?? [])
    .map((i) => ({
      url: i.link,
      hint: [i.title, i.snippet].filter(Boolean).join(" "),
    }))
    .filter((x): x is WebSearchHit => Boolean(x.url));
}

/**
 * Merges Brave + Google CSE (when configured). Keeps the best hint per URL and
 * preserves engine order (Brave first, then Google-only URLs).
 */
export async function fetchWebSearchHits(
  searchQuery: string,
): Promise<WebSearchHit[]> {
  const [brave, google] = await Promise.all([
    fetchBraveHits(searchQuery).catch(() => [] as WebSearchHit[]),
    fetchGoogleHits(searchQuery).catch(() => [] as WebSearchHit[]),
  ]);

  const byUrl = new Map<string, WebSearchHit>();
  for (const h of [...brave, ...google]) {
    const prev = byUrl.get(h.url);
    if (!prev || h.hint.length > prev.hint.length) {
      byUrl.set(h.url, h);
    }
  }

  const ordered: WebSearchHit[] = [];
  const seen = new Set<string>();
  for (const h of [...brave, ...google]) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    const merged = byUrl.get(h.url);
    if (merged) ordered.push(merged);
  }
  return ordered;
}

export type WebSearchProvider = "brave" | "google_cse" | "merged";

export function preferredWebSearchProvider(): WebSearchProvider | null {
  const prefer = process.env.PDF_DISCOVERY_PROVIDER?.trim().toLowerCase() ?? "";
  if (prefer === "google_cse" || prefer === "google") {
    return googleCseConfigured() ? "google_cse" : braveSearchConfigured() ? "brave" : null;
  }
  if (braveSearchConfigured() && googleCseConfigured()) return "merged";
  if (braveSearchConfigured()) return "brave";
  if (googleCseConfigured()) return "google_cse";
  return null;
}
