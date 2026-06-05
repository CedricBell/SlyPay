import net from "node:net";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { hostnameMatchesIssuer } from "@/server/card-intelligence/issuer-official-domains";
import { resolveIssuerOfficialHostsWithDb } from "@/server/card-intelligence/issuer-official-hosts";
import { resolveIssuerCrawlOrigins } from "@/server/card-intelligence/issuer-crawl-origins";
import {
  buildIssuerScopedSearchQuery,
  buildMinimalHumanSearchQuery,
  buildOpenWebSearchQuery,
  buildSlugFirstSearchQuery,
  scorePdfCandidate,
  siblingSlugExclusionTerms,
} from "@/server/card-intelligence/pdf-discovery-query";
import {
  fetchWebSearchHits,
  openWebDiscoveryEnabled,
  preferredWebSearchProvider,
  type WebSearchHit,
  type WebSearchProvider,
} from "@/server/card-intelligence/intel-web-search";
import { fetchIssuerHtml } from "@/server/card-intelligence/issuer-html-links";
import { scoreRewardRichnessInPlainText } from "@/server/card-intelligence/intel-document-intent";
import {
  classifyIntelDocumentIntent,
  intentScoreAdjustment,
} from "@/server/card-intelligence/intel-document-intent";
import {
  isAncillaryIssuerFeaturePath,
  looksLikeOfficialTermsHtmlPath,
  pathBonusForIntelDocument,
} from "@/server/card-intelligence/intel-path-bonus";
import { discoverIntelViaCardProductPage } from "@/server/card-intelligence/issuer-card-page-discovery";
import { harvestIssuerSiteLinks } from "@/server/card-intelligence/issuer-site-crawl";
import { hostnameResolvesOnlyToPublicAddresses } from "@/server/card-intelligence/public-pdf-host";
import {
  buildCoBrandScopedSearchQuery,
  coBrandIntelPathBonus,
  resolveIntelDiscoveryHosts,
  type CoBrandContext,
} from "@/server/card-intelligence/co-brand-discovery";
import { resolveIntelIssuerAndCardName } from "@/server/catalog-infer";
import {
  isGenericIssuerCardHub,
  isIntelSourceCategoryHub,
  isIssuerApplyFormUrl,
  isThirdPartyIntelHost,
  isUrlExcluded,
  shouldTrustSearchRankedProductUrl,
} from "@/server/card-intelligence/intel-source-url-quality";
import { probeIntelDocumentUrl } from "@/server/card-intelligence/intel-document-probe";

type SearchHit = WebSearchHit;

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
  if (
    /\/credit-cards?\//i.test(path) ||
    /\/card\//i.test(path) ||
    /\/apple-card/i.test(path)
  ) {
    return false;
  }
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
    coBrand?: CoBrandContext | null;
    excludeUrls?: string[];
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
    if (isUrlExcluded(raw, opts.excludeUrls ?? [])) continue;
    if (!hostnameMatchesIssuer(url.hostname, hosts)) continue;
    if (isIntelSourceCategoryHub(raw)) continue;
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
    const cb = coBrandIntelPathBonus(raw, opts.coBrand);
    const isPdf = await isPdfCached(raw);
    enriched.push({
      url: raw,
      base,
      pb,
      total: base + pb + cb,
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
    coBrand?: CoBrandContext | null;
    excludeUrls?: string[];
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
    if (isUrlExcluded(raw, opts.excludeUrls ?? [])) continue;
    if (isIntelSourceCategoryHub(raw)) continue;
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
    const cb = coBrandIntelPathBonus(raw, opts.coBrand);
    const isPdf = await isPdfCached(raw);
    enriched.push({
      url: raw,
      base,
      pb,
      total: base + pb + cb,
      isPdf,
      index: i,
    });
  }

  return resolveBestIntelFromEnriched(enriched, { openWebDnsCheck: true });
}

const MIN_PAGE_CONTENT_REWARD_SCORE = 18;
const MIN_HUMAN_FIRST_LINK_REWARD_SCORE = 10;
const MAX_CONTENT_VERIFY_FETCHES = 6;
const HUMAN_SEARCH_TOP_N = 4;

/** Blogs / aggregators — not official product intel. */
const JUNK_OPEN_WEB_HOST =
  /(?:^|\.)((?:www\.)?(?:reddit|nerdwallet|thepointsguy|doctorofcredit|wikipedia|facebook|youtube|tiktok|pinterest|quora|instagram|linkedin|medium|substack))\.[a-z.]+$/i;

function isJunkOpenWebHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return JUNK_OPEN_WEB_HOST.test(h);
}

function filterSearchHitsForOpenWeb(
  hits: SearchHit[],
  excludeUrls: string[] = [],
): SearchHit[] {
  return hits.filter((hit) => {
    if (isUrlExcluded(hit.url, excludeUrls)) return false;
    try {
      const u = new URL(hit.url);
      if (u.protocol !== "https:") return false;
      if (net.isIP(u.hostname)) return false;
      if (isJunkOpenWebHost(u.hostname)) return false;
      if (isThirdPartyIntelHost(u.hostname)) return false;
      if (isIssuerApplyFormUrl(hit.url)) return false;
      if (isGenericIssuerCardHub(hit.url)) return false;
      if (isIntelSourceCategoryHub(hit.url)) return false;
      if (isAncillaryIssuerFeaturePath(u.pathname + u.search)) return false;
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * When URL scoring is ambiguous, fetch candidate pages and pick the one whose
 * plain text actually describes earn rates / rewards (closer to human judgment).
 */
async function pickIntelSourceByPageContent(
  hits: SearchHit[],
  opts: {
    cardName: string;
    issuer?: string;
    productSlug: string;
    exclusionTerms: string[];
    coBrand?: CoBrandContext | null;
    hosts?: string[];
  },
): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const ranked = [...hits].slice(0, MAX_CONTENT_VERIFY_FETCHES);
  let best: { url: string; score: number; rank: number } | null = null;

  for (let i = 0; i < ranked.length; i++) {
    const { url: raw, hint } = ranked[i];
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    if (parsed.protocol !== "https:") continue;
    if (net.isIP(parsed.hostname)) continue;
    if (isIntelSourceCategoryHub(raw)) continue;
    if (isAncillaryIssuerFeaturePath(parsed.pathname + parsed.search)) continue;
    if (opts.hosts?.length && !hostnameMatchesIssuer(parsed.hostname, opts.hosts)) {
      continue;
    }

    const html = await fetchIssuerHtml(raw);
    if (!html) continue;

    const richness = scoreRewardRichnessInPlainText(html);
    if (richness < MIN_PAGE_CONTENT_REWARD_SCORE) continue;

    const urlScore = scorePdfCandidate({
      url: raw,
      hint,
      cardName: opts.cardName,
      issuer: opts.issuer,
      productSlug: opts.productSlug,
      exclusionTerms: opts.exclusionTerms,
      resultIndex: i,
    });
    const pb = pathBonusForIntelDocument(parsed);
    const cb = coBrandIntelPathBonus(raw, opts.coBrand);
    const total = richness * 3 + urlScore + pb + cb;

    if (!best || total > best.score) {
      best = { url: raw, score: total, rank: i };
    }
  }

  if (!best) return null;
  const sourceKind = await inferIntelDocumentKindFromUrl(best.url);
  return { url: best.url, sourceKind };
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

function buildScopedIntelSearchQuery(args: {
  issuer: string;
  cardName: string;
  hosts: string[];
  exclusionTerms: string[];
  coBrand?: CoBrandContext | null;
}): string {
  if (args.coBrand) {
    return buildCoBrandScopedSearchQuery({
      hosts: args.hosts,
      coBrand: args.coBrand,
      cardName: args.cardName,
      exclusionTerms: args.exclusionTerms,
    });
  }
  return buildIssuerScopedSearchQuery({
    hosts: args.hosts,
    cardName: args.cardName,
    exclusionTerms: args.exclusionTerms,
    extraSiteHosts: siteHostsForScopedSearch(args.issuer, args.hosts),
  });
}

/**
 * Mimics manual Google: short query → trust top results → keep first page
 * whose body actually describes rewards (not URL heuristics alone).
 */
async function pickFirstOfficialBraveHit(
  hits: SearchHit[],
  hosts: string[],
  coBrand?: CoBrandContext | null,
): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const retailerHosts = coBrand?.retailerHosts ?? [];
  for (let i = 0; i < Math.min(HUMAN_SEARCH_TOP_N, hits.length); i++) {
    const raw = hits[i]!.url;
    let host = "";
    try {
      host = new URL(raw).hostname;
    } catch {
      continue;
    }
    const onIssuer = hostnameMatchesIssuer(host, hosts);
    const onRetailer = retailerHosts.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
    if (!onIssuer && !onRetailer) continue;
    const probed = await probeIntelDocumentUrl(raw);
    if (probed.reachable || probed.status === 403) {
      return { url: raw, sourceKind: probed.kind };
    }
  }
  return null;
}

async function discoverViaHumanStyleSearch(args: {
  cardName: string;
  productSlug: string;
  issuer: string;
  exclusionTerms: string[];
  coBrand?: CoBrandContext | null;
  excludeUrls?: string[];
  hosts: string[];
}): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const queries = [
    buildMinimalHumanSearchQuery({
      cardName: args.cardName,
      productSlug: args.productSlug,
      issuer: args.issuer,
    }),
    buildSlugFirstSearchQuery({
      productSlug: args.productSlug,
      cardName: args.cardName,
      issuer: args.issuer,
      exclusionTerms: args.exclusionTerms,
    }),
  ];

  for (const q of queries) {
    if (q.length < 4) continue;
    const hits = filterSearchHitsForOpenWeb(
      await fetchWebSearchHits(q),
      args.excludeUrls ?? [],
    );
    const officialFirst = await pickFirstOfficialBraveHit(
      hits,
      args.hosts,
      args.coBrand,
    );
    if (officialFirst) return officialFirst;

    for (let i = 0; i < Math.min(HUMAN_SEARCH_TOP_N, hits.length); i++) {
      const { url: raw, hint } = hits[i];
      if (isIntelSourceCategoryHub(raw)) continue;

      const urlScore = scorePdfCandidate({
        url: raw,
        hint,
        cardName: args.cardName,
        issuer: args.issuer,
        productSlug: args.productSlug,
        exclusionTerms: args.exclusionTerms,
        resultIndex: i,
      });
      if (urlScore < -40) continue;

      if (
        shouldTrustSearchRankedProductUrl(raw, {
          productSlug: args.productSlug,
          cardName: args.cardName,
          searchRank: i,
          hint,
        })
      ) {
        const probed = await probeIntelDocumentUrl(raw);
        if (probed.reachable || probed.status === 403) {
          return { url: raw, sourceKind: probed.kind };
        }
      }

      const html = await fetchIssuerHtml(raw);
      if (!html) continue;
      const richness =
        scoreRewardRichnessInPlainText(html) +
        scoreRewardRichnessInPlainText(hint);
      if (richness < MIN_HUMAN_FIRST_LINK_REWARD_SCORE) continue;

      const sourceKind = await inferIntelDocumentKindFromUrl(raw);
      return { url: raw, sourceKind };
    }
  }
  return null;
}

async function discoverScopedViaWebSearch(args: {
  issuer: string;
  cardName: string;
  productSlug: string;
  hosts: string[];
  exclusionTerms: string[];
  coBrand?: CoBrandContext | null;
  excludeUrls?: string[];
}): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const q = buildScopedIntelSearchQuery(args);
  const hits = fetchWebSearchHits(q).then((h) =>
    filterSearchHitsForOpenWeb(h, args.excludeUrls ?? []),
  );
  const pickOpts = {
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms: args.exclusionTerms,
    coBrand: args.coBrand,
    excludeUrls: args.excludeUrls,
  };
  const ranked = await pickBestOfficialIntelSource(
    args.hosts,
    await hits,
    pickOpts,
  );
  if (ranked) return ranked;
  return pickIntelSourceByPageContent(await hits, {
    ...pickOpts,
    hosts: args.hosts,
  });
}

async function discoverOpenWebViaSearch(args: {
  issuer: string;
  cardName: string;
  productSlug: string;
  exclusionTerms: string[];
  coBrand?: CoBrandContext | null;
  hosts?: string[];
  excludeUrls?: string[];
}): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const pickOpts = {
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms: args.exclusionTerms,
    coBrand: args.coBrand,
    excludeUrls: args.excludeUrls,
  };

  const queries = [
    buildMinimalHumanSearchQuery({
      cardName: args.cardName,
      productSlug: args.productSlug,
      issuer: args.issuer,
    }),
    buildSlugFirstSearchQuery({
      productSlug: args.productSlug,
      cardName: args.cardName,
      issuer: args.issuer,
      exclusionTerms: args.exclusionTerms,
    }),
    buildOpenWebSearchQuery({
      issuer: args.issuer,
      cardName: args.cardName,
      exclusionTerms: args.exclusionTerms,
      productSlug: args.productSlug,
    }),
  ];

  for (const q of queries) {
    if (q.length < 4) continue;
    const hits = filterSearchHitsForOpenWeb(
      await fetchWebSearchHits(q),
      args.excludeUrls ?? [],
    );
    const ranked = await pickBestOpenWebIntelSource(hits, pickOpts);
    if (ranked) return ranked;
    const verified = await pickIntelSourceByPageContent(hits, {
      ...pickOpts,
      hosts: args.hosts,
    });
    if (verified) return verified;
  }
  return null;
}

export type PdfDiscoveryProvider = WebSearchProvider | null;

/**
 * 1) **Human-style web search** (Brave — whole web): `"Card Name" credit card` → top links → HTML rewards check.
 * 2) Guessed product URLs + issuer hub crawl.
 * 3) Scoped `site:…` search + richer open-web queries.
 * Google CSE is optional (often cannot enable « entire web »); Brave replaces it.
 */
export async function discoverOfficialPdfUrl(args: {
  issuer: string;
  cardName: string;
  /** Catalog slug — drives sibling exclusions (e.g. discover-it vs discover-it-miles). */
  productSlug: string;
  /** URLs that failed extraction or are known category hubs — never pick again. */
  excludeUrls?: string[];
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

  const discovery = await resolveIntelDiscoveryHosts(
    issuer,
    cardName,
    args.productSlug,
  );
  const hosts = discovery.hosts;
  const coBrand = discovery.coBrand;
  const cardNameForDiscovery = discovery.cardNameForDiscovery;
  const issuerForDiscovery = discovery.issuerForDiscovery;

  const exclusionTerms = siblingSlugExclusionTerms(
    issuerForDiscovery,
    args.productSlug,
  );
  const excludeUrls = args.excludeUrls ?? [];
  const searchProvider = preferredWebSearchProvider();

  const scopedPayload = {
    issuer: issuerForDiscovery,
    cardName: cardNameForDiscovery,
    productSlug: args.productSlug,
    hosts,
    exclusionTerms,
    coBrand,
    excludeUrls,
  };

  const openPayload = {
    issuer: issuerForDiscovery,
    cardName: cardNameForDiscovery,
    productSlug: args.productSlug,
    exclusionTerms,
    coBrand,
    hosts,
    excludeUrls,
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

  const catalogCuratedUrl = CARD_CATALOG_ENTRIES.find(
    (e) => e.id === args.productSlug,
  )?.officialDocumentUrl;
  if (
    catalogCuratedUrl &&
    !isUrlExcluded(catalogCuratedUrl, excludeUrls) &&
    !isIntelSourceCategoryHub(catalogCuratedUrl) &&
    !isGenericIssuerCardHub(catalogCuratedUrl)
  ) {
    const probed = await probeIntelDocumentUrl(catalogCuratedUrl);
    if (probed.reachable || probed.status === 403) {
      return withResolved({
        url: catalogCuratedUrl,
        sourceKind: probed.kind,
        provider: null,
      });
    }
  }

  const tryHumanSearch = () =>
    openWebDiscoveryEnabled()
      ? discoverViaHumanStyleSearch({
          cardName: cardNameForDiscovery,
          productSlug: args.productSlug,
          issuer: issuerForDiscovery,
          exclusionTerms,
          coBrand,
          excludeUrls,
          hosts,
        })
      : Promise.resolve(null);
  const tryScopedSearch = () => discoverScopedViaWebSearch(scopedPayload);
  const tryOpenSearch = () =>
    openWebDiscoveryEnabled()
      ? discoverOpenWebViaSearch(openPayload)
      : Promise.resolve(null);

  const searchHit = (
    r: { url: string; sourceKind: IntelDocumentKind } | null,
  ): DiscoveryResult | null =>
    r
      ? withResolved({
          url: r.url,
          sourceKind: r.sourceKind,
          provider: searchProvider,
        })
      : null;

  const humanFirst = await tryHumanSearch();
  const humanHit = searchHit(humanFirst);
  if (humanHit) return humanHit;

  if (hosts.length) {
    const fromCardFlow = await discoverIntelViaCardProductPage({
      hosts,
      cardName: cardNameForDiscovery,
      issuer: issuerForDiscovery,
      productSlug: args.productSlug,
      exclusionTerms,
      coBrand,
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
      cardName: cardNameForDiscovery,
      issuer: issuerForDiscovery,
      productSlug: args.productSlug,
      exclusionTerms,
    });
    if (hubHits.length) {
      const fromHub = await pickBestOfficialIntelSource(hosts, hubHits, {
        cardName: cardNameForDiscovery,
        issuer: issuerForDiscovery,
        productSlug: args.productSlug,
        exclusionTerms,
        coBrand,
      });
      if (fromHub) {
        return withResolved({
          url: fromHub.url,
          sourceKind: fromHub.sourceKind,
          provider: null,
        });
      }
    }

    const scoped = await tryScopedSearch();
    const scopedHit = searchHit(scoped);
    if (scopedHit) return scopedHit;

    const open = await tryOpenSearch();
    const openHit = searchHit(open);
    if (openHit) return openHit;

    return withResolved({ url: null, sourceKind: null, provider: null });
  }

  const openOnly = await tryOpenSearch();
  const openOnlyHit = searchHit(openOnly);
  if (openOnlyHit) return openOnlyHit;

  return withResolved({ url: null, sourceKind: null, provider: null });
}
