import net from "node:net";
import { hostnameMatchesIssuer } from "@/server/card-intelligence/issuer-official-domains";
import { resolveIssuerOfficialHostsWithDb } from "@/server/card-intelligence/issuer-official-hosts";
import {
  buildIssuerScopedSearchQuery,
  buildOpenWebSearchQuery,
  scorePdfCandidate,
  siblingSlugExclusionTerms,
} from "@/server/card-intelligence/pdf-discovery-query";
import { hostnameResolvesOnlyToPublicAddresses } from "@/server/card-intelligence/public-pdf-host";

type GoogleCseItem = { link?: string; title?: string; snippet?: string };
type GoogleCseResponse = { items?: GoogleCseItem[] };

type BraveWebResult = { url?: string; title?: string; description?: string };
type BraveWebResponse = {
  web?: { results?: BraveWebResult[] };
};

type SearchHit = { url: string; hint: string };

async function looksLikePdfUrl(url: URL): Promise<boolean> {
  const path = url.pathname.toLowerCase();
  if (path.endsWith(".pdf")) return true;
  try {
    const head = await fetch(url.toString(), {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const ct = head.headers.get("content-type") ?? "";
    return ct.toLowerCase().includes("application/pdf");
  } catch {
    return path.includes(".pdf");
  }
}

async function pickBestOfficialPdf(
  hosts: string[],
  hits: SearchHit[],
  opts: {
    cardName: string;
    issuer?: string;
    productSlug: string;
    exclusionTerms: string[];
  },
): Promise<string | null> {
  const scored: { url: string; score: number; index: number }[] = [];
  for (let i = 0; i < hits.length; i++) {
    const { url: raw, hint } = hits[i];
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== "https:") continue;
    if (!hostnameMatchesIssuer(url.hostname, hosts)) continue;
    const score = scorePdfCandidate({
      url: raw,
      hint,
      cardName: opts.cardName,
      issuer: opts.issuer,
      productSlug: opts.productSlug,
      exclusionTerms: opts.exclusionTerms,
      resultIndex: i,
    });
    scored.push({ url: raw, score, index: i });
  }
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  for (const c of scored) {
    if (await looksLikePdfUrl(new URL(c.url))) return c.url;
  }
  return null;
}

/**
 * Open-web ranking: same textual scoring, but any HTTPS host whose DNS resolves
 * only to public IPs (SSRF mitigation). Skips literal-IP URLs in results.
 */
async function pickBestOpenWebPdf(
  hits: SearchHit[],
  opts: {
    cardName: string;
    issuer?: string;
    productSlug: string;
    exclusionTerms: string[];
  },
): Promise<string | null> {
  const scored: { url: string; score: number; index: number }[] = [];
  for (let i = 0; i < hits.length; i++) {
    const { url: raw, hint } = hits[i];
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== "https:") continue;
    if (net.isIP(url.hostname)) continue;
    const score = scorePdfCandidate({
      url: raw,
      hint,
      cardName: opts.cardName,
      issuer: opts.issuer,
      productSlug: opts.productSlug,
      exclusionTerms: opts.exclusionTerms,
      resultIndex: i,
    });
    scored.push({ url: raw, score, index: i });
  }
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  for (const c of scored.slice(0, 18)) {
    const url = new URL(c.url);
    if (!(await hostnameResolvesOnlyToPublicAddresses(url.hostname))) continue;
    if (await looksLikePdfUrl(url)) return c.url;
  }
  return null;
}

async function fetchBraveHits(searchQuery: string): Promise<SearchHit[]> {
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
    throw new Error(`Brave Search failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as BraveWebResponse;
  return (data.web?.results ?? [])
    .map((r) => ({
      url: r.url,
      hint: [r.title, r.description].filter(Boolean).join(" "),
    }))
    .filter((x): x is SearchHit => Boolean(x.url));
}

async function fetchGoogleHits(searchQuery: string): Promise<SearchHit[]> {
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
    throw new Error(`Google CSE failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as GoogleCseResponse;
  return (data.items ?? [])
    .map((i) => ({
      url: i.link,
      hint: [i.title, i.snippet].filter(Boolean).join(" "),
    }))
    .filter((x): x is SearchHit => Boolean(x.url));
}

async function discoverScopedPdfUrlViaBrave(args: {
  issuer: string;
  cardName: string;
  productSlug: string;
  hosts: string[];
  exclusionTerms: string[];
}): Promise<string | null> {
  const q = buildIssuerScopedSearchQuery({
    hosts: args.hosts,
    cardName: args.cardName,
    exclusionTerms: args.exclusionTerms,
  });
  const hits = await fetchBraveHits(q);
  return pickBestOfficialPdf(args.hosts, hits, {
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms: args.exclusionTerms,
  });
}

async function discoverScopedPdfUrlViaGoogleCse(args: {
  issuer: string;
  cardName: string;
  productSlug: string;
  hosts: string[];
  exclusionTerms: string[];
}): Promise<string | null> {
  const q = buildIssuerScopedSearchQuery({
    hosts: args.hosts,
    cardName: args.cardName,
    exclusionTerms: args.exclusionTerms,
  });
  const hits = await fetchGoogleHits(q);
  return pickBestOfficialPdf(args.hosts, hits, {
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms: args.exclusionTerms,
  });
}

async function discoverOpenWebPdfUrlViaBrave(args: {
  issuer: string;
  cardName: string;
  productSlug: string;
  exclusionTerms: string[];
}): Promise<string | null> {
  const q = buildOpenWebSearchQuery({
    issuer: args.issuer,
    cardName: args.cardName,
    exclusionTerms: args.exclusionTerms,
  });
  if (q.length < 4) return null;
  const hits = await fetchBraveHits(q);
  return pickBestOpenWebPdf(hits, {
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms: args.exclusionTerms,
  });
}

async function discoverOpenWebPdfUrlViaGoogleCse(args: {
  issuer: string;
  cardName: string;
  productSlug: string;
  exclusionTerms: string[];
}): Promise<string | null> {
  const q = buildOpenWebSearchQuery({
    issuer: args.issuer,
    cardName: args.cardName,
    exclusionTerms: args.exclusionTerms,
  });
  if (q.length < 4) return null;
  const hits = await fetchGoogleHits(q);
  return pickBestOpenWebPdf(hits, {
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms: args.exclusionTerms,
  });
}

export type PdfDiscoveryProvider = "brave" | "google_cse" | null;

/**
 * Prefers HTTPS PDFs on issuer-mapped official domains (`site:` query).
 * If the issuer has **no** mapped domains, runs an **open-web** search (no `site:`)
 * and keeps only candidates whose hostname resolves exclusively to public IPs.
 *
 * Order: Brave → Google CSE (or reversed when `PDF_DISCOVERY_PROVIDER=google_cse`).
 */
export async function discoverOfficialPdfUrl(args: {
  issuer: string;
  cardName: string;
  /** Catalog slug — drives sibling exclusions (e.g. discover-it vs discover-it-miles). */
  productSlug: string;
}): Promise<{ url: string | null; provider: PdfDiscoveryProvider }> {
  const hosts = await resolveIssuerOfficialHostsWithDb(args.issuer);
  const exclusionTerms = siblingSlugExclusionTerms(
    args.issuer,
    args.productSlug,
  );
  const prefer =
    process.env.PDF_DISCOVERY_PROVIDER?.trim().toLowerCase() ?? "";

  const scopedPayload = {
    issuer: args.issuer,
    cardName: args.cardName,
    productSlug: args.productSlug,
    hosts,
    exclusionTerms,
  };

  const openPayload = {
    issuer: args.issuer,
    cardName: args.cardName,
    productSlug: args.productSlug,
    exclusionTerms,
  };

  const tryScopedBrave = () => discoverScopedPdfUrlViaBrave(scopedPayload);
  const tryScopedGoogle = () => discoverScopedPdfUrlViaGoogleCse(scopedPayload);
  const tryOpenBrave = () => discoverOpenWebPdfUrlViaBrave(openPayload);
  const tryOpenGoogle = () => discoverOpenWebPdfUrlViaGoogleCse(openPayload);

  if (hosts.length) {
    if (prefer === "google_cse" || prefer === "google") {
      const g = await tryScopedGoogle();
      if (g) return { url: g, provider: "google_cse" };
      const b = await tryScopedBrave();
      if (b) return { url: b, provider: "brave" };
      return { url: null, provider: null };
    }
    const braveFirst = await tryScopedBrave();
    if (braveFirst) return { url: braveFirst, provider: "brave" };
    const googleSecond = await tryScopedGoogle();
    if (googleSecond) return { url: googleSecond, provider: "google_cse" };
    return { url: null, provider: null };
  }

  if (prefer === "google_cse" || prefer === "google") {
    const g = await tryOpenGoogle();
    if (g) return { url: g, provider: "google_cse" };
    const b = await tryOpenBrave();
    if (b) return { url: b, provider: "brave" };
    return { url: null, provider: null };
  }

  const openBrave = await tryOpenBrave();
  if (openBrave) return { url: openBrave, provider: "brave" };
  const openGoogle = await tryOpenGoogle();
  if (openGoogle) return { url: openGoogle, provider: "google_cse" };
  return { url: null, provider: null };
}
