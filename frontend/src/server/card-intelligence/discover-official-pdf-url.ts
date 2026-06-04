import net from "node:net";
import { hostnameMatchesIssuer } from "@/server/card-intelligence/issuer-official-domains";
import { resolveIssuerOfficialHostsWithDb } from "@/server/card-intelligence/issuer-official-hosts";
import { resolveIssuerCrawlOrigins } from "@/server/card-intelligence/issuer-crawl-origins";
import {
  buildIssuerScopedSearchQuery,
  buildOpenWebSearchQuery,
  scorePdfCandidate,
  siblingSlugExclusionTerms,
} from "@/server/card-intelligence/pdf-discovery-query";
import {
  classifyIntelDocumentIntent,
  intentScoreAdjustment,
} from "@/server/card-intelligence/intel-document-intent";
import {
  isAncillaryIssuerFeaturePath,
  looksLikeOfficialTermsHtmlPath,
  pathBonusForIntelDocument,
} from "@/server/card-intelligence/intel-path-bonus";
import { issuerUsesOnlyGuessedDomains } from "@/server/card-intelligence/issuer-domain-guess";
import { discoverIntelViaCardProductPage } from "@/server/card-intelligence/issuer-card-page-discovery";
import { harvestIssuerSiteLinks } from "@/server/card-intelligence/issuer-site-crawl";
import { hostnameResolvesOnlyToPublicAddresses } from "@/server/card-intelligence/public-pdf-host";
import { resolveIntelIssuerAndCardName } from "@/server/catalog-infer";

function openWebDiscoveryEnabled(): boolean {
  const v = process.env.INTEL_ALLOW_OPEN_WEB?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

type GoogleCseItem = { link?: string; title?: string; snippet?: string };
type GoogleCseResponse = { items?: GoogleCseItem[] };

type BraveWebResult = { url?: string; title?: string; description?: string };
type BraveWebResponse = {
  web?: { results?: BraveWebResult[] };
};

type SearchHit = { url: string; hint: string };

export type IntelDocumentKind = "pdf" | "html";

type EnrichedHit = {
  url: string;
  base: number;
  pb: number;
  total: number;
  isPdf: boolean;
  index: number;
};

/** Infer from URL path + optional HEAD `Content-Type` (PDFs without `.pdf` extension). */
export async function inferIntelDocumentKindFromUrl(
  raw: string,
): Promise<IntelDocumentKind> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "html";
  }
  if (url.protocol !== "https:") return "html";
  return (await looksLikePdfUrl(url)) ? "pdf" : "html";
}

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

async function resolveBestIntelFromEnriched(
  rows: EnrichedHit[],
  opts: { openWebDnsCheck: boolean },
): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const rankedTotal = (r: EnrichedHit) =>
    r.total + intentScoreAdjustment(classifyIntelDocumentIntent(r.url));

  let ordered = [...rows].sort(
    (a, b) => rankedTotal(b) - rankedTotal(a) || a.index - b.index,
  );

  if (opts.openWebDnsCheck) {
    const ok: EnrichedHit[] = [];
    for (const r of ordered) {
      try {
        const host = new URL(r.url).hostname;
        if (await hostnameResolvesOnlyToPublicAddresses(host)) {
          ok.push(r);
        }
      } catch {
        /* skip */
      }
    }
    ordered = ok;
  }

  const bestPdf = ordered.find((r) => r.isPdf) ?? null;
  const strongHtmlList = ordered.filter((r) => !r.isPdf && r.pb >= 52);
  const bestStrongHtml = strongHtmlList[0] ?? null;

  if (bestStrongHtml && bestPdf) {
    const pdfIntent = classifyIntelDocumentIntent(bestPdf.url);
    const htmlIntent = classifyIntelDocumentIntent(bestStrongHtml.url);
    if (pdfIntent === "pricing_legal" && htmlIntent !== "pricing_legal") {
      return { url: bestStrongHtml.url, sourceKind: "html" };
    }
    if (
      rankedTotal(bestStrongHtml) >= rankedTotal(bestPdf) - 8 ||
      htmlIntent === "offer_rewards"
    ) {
      return { url: bestStrongHtml.url, sourceKind: "html" };
    }
    return { url: bestPdf.url, sourceKind: "pdf" };
  }
  if (bestStrongHtml && !bestPdf) {
    return { url: bestStrongHtml.url, sourceKind: "html" };
  }
  if (bestPdf) {
    return { url: bestPdf.url, sourceKind: "pdf" };
  }

  const weakHtml = ordered.find(
    (r) =>
      !r.isPdf &&
      looksLikeOfficialTermsHtmlPath(new URL(r.url)) &&
      r.pb >= 22,
  );
  if (weakHtml) {
    return { url: weakHtml.url, sourceKind: "html" };
  }
  return null;
}

async function pickBestOfficialIntelSource(
  hosts: string[],
  hits: SearchHit[],
  opts: {
    cardName: string;
    issuer?: string;
    productSlug: string;
    exclusionTerms: string[];
  },
): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const pdfCache = new Map<string, boolean>();
  async function isPdfCached(raw: string): Promise<boolean> {
    if (!pdfCache.has(raw)) {
      pdfCache.set(raw, await looksLikePdfUrl(new URL(raw)));
    }
    return pdfCache.get(raw)!;
  }

  const enriched: EnrichedHit[] = [];
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
    if (isAncillaryIssuerFeaturePath(url.pathname + url.search)) continue;
    const base = scorePdfCandidate({
      url: raw,
      hint,
      cardName: opts.cardName,
      issuer: opts.issuer,
      productSlug: opts.productSlug,
      exclusionTerms: opts.exclusionTerms,
      resultIndex: i,
    });
    const pb = pathBonusForIntelDocument(url);
    const isPdf = await isPdfCached(raw);
    enriched.push({
      url: raw,
      base,
      pb,
      total: base + pb,
      isPdf,
      index: i,
    });
  }

  return resolveBestIntelFromEnriched(enriched, { openWebDnsCheck: false });
}

/**
 * Open-web: same ranking as scoped, plus public-DNS filter for each candidate.
 */
async function pickBestOpenWebIntelSource(
  hits: SearchHit[],
  opts: {
    cardName: string;
    issuer?: string;
    productSlug: string;
    exclusionTerms: string[];
  },
): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const pdfCache = new Map<string, boolean>();
  async function isPdfCached(raw: string): Promise<boolean> {
    if (!pdfCache.has(raw)) {
      pdfCache.set(raw, await looksLikePdfUrl(new URL(raw)));
    }
    return pdfCache.get(raw)!;
  }

  const enriched: EnrichedHit[] = [];
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
    const base = scorePdfCandidate({
      url: raw,
      hint,
      cardName: opts.cardName,
      issuer: opts.issuer,
      productSlug: opts.productSlug,
      exclusionTerms: opts.exclusionTerms,
      resultIndex: i,
    });
    const pb = pathBonusForIntelDocument(url);
    const isPdf = await isPdfCached(raw);
    enriched.push({
      url: raw,
      base,
      pb,
      total: base + pb,
      isPdf,
      index: i,
    });
  }

  return resolveBestIntelFromEnriched(enriched, { openWebDnsCheck: true });
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

function siteHostsForScopedSearch(issuer: string, apexHosts: string[]): string[] {
  const extra = resolveIssuerCrawlOrigins(issuer)
    .map((o) => {
      try {
        return new URL(o).hostname;
      } catch {
        return null;
      }
    })
    .filter((h): h is string => Boolean(h));
  return [...new Set([...apexHosts, ...extra])];
}

async function discoverScopedPdfUrlViaBrave(args: {
  issuer: string;
  cardName: string;
  productSlug: string;
  hosts: string[];
  exclusionTerms: string[];
}): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const q = buildIssuerScopedSearchQuery({
    hosts: args.hosts,
    cardName: args.cardName,
    exclusionTerms: args.exclusionTerms,
    extraSiteHosts: siteHostsForScopedSearch(args.issuer, args.hosts),
  });
  const hits = await fetchBraveHits(q);
  return pickBestOfficialIntelSource(args.hosts, hits, {
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
}): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const q = buildIssuerScopedSearchQuery({
    hosts: args.hosts,
    cardName: args.cardName,
    exclusionTerms: args.exclusionTerms,
    extraSiteHosts: siteHostsForScopedSearch(args.issuer, args.hosts),
  });
  const hits = await fetchGoogleHits(q);
  return pickBestOfficialIntelSource(args.hosts, hits, {
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
}): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const q = buildOpenWebSearchQuery({
    issuer: args.issuer,
    cardName: args.cardName,
    exclusionTerms: args.exclusionTerms,
  });
  if (q.length < 4) return null;
  const hits = await fetchBraveHits(q);
  return pickBestOpenWebIntelSource(hits, {
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
}): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const q = buildOpenWebSearchQuery({
    issuer: args.issuer,
    cardName: args.cardName,
    exclusionTerms: args.exclusionTerms,
  });
  if (q.length < 4) return null;
  const hits = await fetchGoogleHits(q);
  return pickBestOpenWebIntelSource(hits, {
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms: args.exclusionTerms,
  });
}

export type PdfDiscoveryProvider = "brave" | "google_cse" | null;

/**
 * Finds rewards/terms on the **issuer's own site** when domains are mapped:
 * 1) hub → card product page → « Rewards and rules » link (no search engine),
 * 2) hub crawl fallback,
 * 3) optional `site:issuer.com` via Brave/Google only if `INTEL_ALLOW_ISSUER_SITE_SEARCH=1`.
 * Open-web search is **off** unless `INTEL_ALLOW_OPEN_WEB=1`.
 */
export async function discoverOfficialPdfUrl(args: {
  issuer: string;
  cardName: string;
  /** Catalog slug — drives sibling exclusions (e.g. discover-it vs discover-it-miles). */
  productSlug: string;
}): Promise<{
  url: string | null;
  sourceKind: IntelDocumentKind | null;
  provider: PdfDiscoveryProvider;
  /** Issuer/card labels used for discovery (may differ from DB when placeholder was corrected). */
  resolvedIssuer?: string;
  resolvedCardName?: string;
}> {
  const resolved = resolveIntelIssuerAndCardName(args.issuer, args.cardName);
  const issuer = resolved.issuer;
  const cardName = resolved.cardName;

  const hosts = await resolveIssuerOfficialHostsWithDb(issuer);
  const exclusionTerms = siblingSlugExclusionTerms(issuer, args.productSlug);
  const guessedOnly =
    hosts.length > 0 && issuerUsesOnlyGuessedDomains(issuer, hosts);
  const prefer =
    process.env.PDF_DISCOVERY_PROVIDER?.trim().toLowerCase() ?? "";

  const scopedPayload = {
    issuer,
    cardName,
    productSlug: args.productSlug,
    hosts,
    exclusionTerms,
  };

  const openPayload = {
    issuer,
    cardName,
    productSlug: args.productSlug,
    exclusionTerms,
  };

  type DiscoveryResult = {
    url: string | null;
    sourceKind: IntelDocumentKind | null;
    provider: PdfDiscoveryProvider;
    resolvedIssuer?: string;
    resolvedCardName?: string;
  };

  const withResolved = (
    r: Omit<DiscoveryResult, "resolvedIssuer" | "resolvedCardName">,
  ): DiscoveryResult => ({
    ...r,
    resolvedIssuer: issuer,
    resolvedCardName: cardName,
  });

  const tryScopedBrave = () => discoverScopedPdfUrlViaBrave(scopedPayload);
  const tryScopedGoogle = () => discoverScopedPdfUrlViaGoogleCse(scopedPayload);
  const tryOpenBrave = () => discoverOpenWebPdfUrlViaBrave(openPayload);
  const tryOpenGoogle = () => discoverOpenWebPdfUrlViaGoogleCse(openPayload);

  if (hosts.length) {
    const fromCardFlow = await discoverIntelViaCardProductPage({
      hosts,
      cardName,
      issuer,
      productSlug: args.productSlug,
      exclusionTerms,
    });
    if (fromCardFlow) {
      return withResolved({
        url: fromCardFlow.url,
        sourceKind: fromCardFlow.sourceKind,
        provider: null,
      });
    }

    const hubHits = await harvestIssuerSiteLinks({
      hosts,
      cardName,
      issuer,
      productSlug: args.productSlug,
      exclusionTerms,
    });
    if (hubHits.length) {
      const fromHub = await pickBestOfficialIntelSource(hosts, hubHits, {
        cardName,
        issuer,
        productSlug: args.productSlug,
        exclusionTerms,
      });
      if (fromHub) {
        return withResolved({
          url: fromHub.url,
          sourceKind: fromHub.sourceKind,
          provider: null,
        });
      }
    }

    // Last resort: issuer-scoped search (`site:chase.com` includes creditcards.chase.com).
    if (prefer === "google_cse" || prefer === "google") {
      const g = await tryScopedGoogle();
      if (g)
        return withResolved({
          url: g.url,
          sourceKind: g.sourceKind,
          provider: "google_cse",
        });
      const b = await tryScopedBrave();
      if (b)
        return withResolved({
          url: b.url,
          sourceKind: b.sourceKind,
          provider: "brave",
        });
    } else {
      const braveFirst = await tryScopedBrave();
      if (braveFirst)
        return withResolved({
          url: braveFirst.url,
          sourceKind: braveFirst.sourceKind,
          provider: "brave",
        });
      const googleSecond = await tryScopedGoogle();
      if (googleSecond)
        return withResolved({
          url: googleSecond.url,
          sourceKind: googleSecond.sourceKind,
          provider: "google_cse",
        });
    }

    if (guessedOnly && !openWebDiscoveryEnabled()) {
      const openBrave = await tryOpenBrave();
      if (openBrave)
        return withResolved({
          url: openBrave.url,
          sourceKind: openBrave.sourceKind,
          provider: "brave",
        });
      const openGoogle = await tryOpenGoogle();
      if (openGoogle)
        return withResolved({
          url: openGoogle.url,
          sourceKind: openGoogle.sourceKind,
          provider: "google_cse",
        });
    }

    return withResolved({ url: null, sourceKind: null, provider: null });
  }

  if (!openWebDiscoveryEnabled()) {
    return withResolved({ url: null, sourceKind: null, provider: null });
  }

  if (prefer === "google_cse" || prefer === "google") {
    const g = await tryOpenGoogle();
    if (g)
      return withResolved({
        url: g.url,
        sourceKind: g.sourceKind,
        provider: "google_cse",
      });
    const b = await tryOpenBrave();
    if (b)
      return withResolved({
        url: b.url,
        sourceKind: b.sourceKind,
        provider: "brave",
      });
    return withResolved({ url: null, sourceKind: null, provider: null });
  }

  const openBrave = await tryOpenBrave();
  if (openBrave)
    return withResolved({
      url: openBrave.url,
      sourceKind: openBrave.sourceKind,
      provider: "brave",
    });
  const openGoogle = await tryOpenGoogle();
  if (openGoogle)
    return withResolved({
      url: openGoogle.url,
      sourceKind: openGoogle.sourceKind,
      provider: "google_cse",
    });
  return withResolved({ url: null, sourceKind: null, provider: null });
}
