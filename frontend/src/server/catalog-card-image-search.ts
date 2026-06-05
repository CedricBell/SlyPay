/**
 * Card art discovery via SerpAPI Google Images (SERPAPI_API_KEY).
 */

import {
  buildCatalogImageExclusionTerms,
  coreCardQueryPhrase,
} from "@/server/card-intelligence/pdf-discovery-query";
import {
  coBrandImageSearchQueries,
  detectCoBrandContext,
} from "@/server/card-intelligence/co-brand-discovery";
import {
  catalogImageUrlHasConflictingVariant,
  catalogImageUrlMatchesProductSlug,
  isMarketingBannerImagePath,
  scoreCatalogImageUrl,
} from "@/server/catalog-image-match";
import {
  fetchSerpApiImageHits,
  serpApiImageSearchEnabled,
  type SerpApiImageHit,
} from "@/server/serpapi-image-search";

export { serpApiImageSearchEnabled };

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSearchImageHit(
  url: string,
  title: string,
  args: { issuer: string; cardName: string; productSlug: string },
  resultIndex: number,
  dims?: { width?: number; height?: number },
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

  let score = scoreCatalogImageUrl({
    url,
    hint: title,
    cardName: args.cardName,
    productSlug: args.productSlug,
    issuer: args.issuer,
    resultIndex,
  });

  if (host.includes("americanexpress.com")) score += 40;
  if (host.includes("creditcards.chase.com") || host.includes("capitalone.com")) {
    score += 35;
  }
  if (
    host.includes("creditcards.com") ||
    host.includes("prodstatic.com") ||
    host.includes("citi.com") ||
    host.includes("macys.com") ||
    host.includes("amazon.com") ||
    host.includes("synchrony.com")
  ) {
    score += 25;
  }
  if (issuerN && host.includes(issuerN.split(" ")[0] ?? "")) score += 15;

  for (const term of nameN.split(" ").filter((t) => t.length > 2)) {
    if (titleN.includes(term)) score += 8;
  }
  if (/card\s*art|credit\s*card|metal\s*card|platinum-metal/i.test(titleN)) {
    score += 20;
  }
  if (/\.png(\?|$)/i.test(url)) score += 10;
  if (isMarketingBannerImagePath(url)) score -= 300;
  if (/\/shared\/images\/cards\//i.test(url)) score += 25;
  if (/\/card-art\//i.test(url)) score += 45;

  const w = dims?.width ?? 0;
  const h = dims?.height ?? 0;
  if (w >= 300 && h >= 180) score += 35;
  else if (w >= 200 && h >= 120) score += 18;

  if (
    !catalogImageUrlMatchesProductSlug({
      url,
      productSlug: args.productSlug,
      issuer: args.issuer,
    })
  ) {
    score -= 95;
  }
  if (
    catalogImageUrlHasConflictingVariant({
      url,
      cardName: args.cardName,
      productSlug: args.productSlug,
      issuer: args.issuer,
    })
  ) {
    score -= 200;
  }

  return score;
}

function mergeSerpHits(
  batches: SerpApiImageHit[][],
): SerpApiImageHit[] {
  const byUrl = new Map<string, SerpApiImageHit>();
  let offset = 0;
  for (const batch of batches) {
    for (let i = 0; i < batch.length; i++) {
      const hit = batch[i]!;
      const rank = offset + i;
      const prev = byUrl.get(hit.url);
      if (!prev || rank < prev.rank) {
        byUrl.set(hit.url, { ...hit, rank });
      }
    }
    offset += batch.length;
  }
  return [...byUrl.values()].sort((a, b) => a.rank - b.rank);
}

/** CreditCards.com / WalletHub card art CDN (UUID paths, title-verified). */
export async function discoverProdstaticCardImage(args: {
  issuer: string;
  cardName: string;
}): Promise<Array<{ url: string; title: string; rank: number }>> {
  if (!serpApiImageSearchEnabled()) return [];

  const issuer = args.issuer.trim();
  const cardName = args.cardName.trim();
  if (!cardName) return [];

  const core = coreCardQueryPhrase(cardName) ?? cardName;
  const queries = [
    `site:cdn.prodstatic.com "${issuer}" "${core}" card`,
    `site:cdn.prodstatic.com "${core}" ${issuer}`,
    `site:cdn.prodstatic.com "${issuer} ${core}"`,
  ];

  const batches = await Promise.all(
    queries.map((q) => fetchSerpApiImageHits(q, { num: 15 })),
  );
  return mergeSerpHits(batches).map((h) => ({
    url: h.url,
    title: h.title,
    rank: h.rank,
  }));
}

/** Query like typing the card name into Google Images. */
export function buildHumanCardImageSearchQuery(
  issuer: string,
  cardName: string,
): string {
  const name = cardName.replace(/"/g, " ").trim();
  const iss = issuer.replace(/"/g, " ").trim();
  const issuerWord = iss.toLowerCase().split(/\s+/)[0] ?? "";
  const nameHasIssuer =
    issuerWord.length >= 3 && name.toLowerCase().includes(issuerWord);
  const label =
    iss && !nameHasIssuer ? `${iss} ${name}` : name;
  return `"${label}" credit card`;
}

export type HumanImageSearchHit = {
  url: string;
  title: string;
  rank: number;
  provider: "serpapi";
  width?: number;
  height?: number;
};

/**
 * Human-style Google Images via SerpAPI — preserve result order (rank 0 = first hit).
 */
export async function discoverCatalogCardImageHumanFirst(args: {
  issuer: string;
  cardName: string;
  productSlug?: string;
}): Promise<HumanImageSearchHit[]> {
  if (!serpApiImageSearchEnabled()) return [];

  const issuer = args.issuer.trim();
  const cardName = args.cardName.trim();
  if (!cardName) return [];

  const q = buildHumanCardImageSearchQuery(issuer, cardName);
  const hits = await fetchSerpApiImageHits(q, { num: 25 });
  return hits.map((hit) => ({
    url: hit.url,
    title: hit.title,
    rank: hit.rank,
    provider: "serpapi" as const,
    width: hit.width,
    height: hit.height,
  }));
}

export type RankedImageSearchHit = {
  url: string;
  title: string;
  rank: number;
  score: number;
};

/** Ranked image URLs from SerpAPI Google Images (multi-query). */
export async function discoverCatalogCardImageViaImageSearch(args: {
  issuer: string;
  cardName: string;
  productSlug?: string;
}): Promise<RankedImageSearchHit[]> {
  if (!serpApiImageSearchEnabled()) return [];

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
          : /wells fargo/i.test(issuer)
            ? "wellsfargo.com"
            : /bank of america/i.test(issuer)
              ? "bankofamerica.com"
              : /citi/i.test(issuer)
                ? "citi.com"
                : null;

  const slug = args.productSlug?.trim() ?? "";
  const coBrand = detectCoBrandContext(issuer, cardName);
  const exclusions = slug
    ? buildCatalogImageExclusionTerms(
        coBrand?.bankIssuer ?? issuer,
        slug,
      )
    : [];
  const neg = exclusions
    .filter((t) => t.length >= 3)
    .map((t) => `-${t}`)
    .join(" ");
  const core = coreCardQueryPhrase(cardName) ?? cardName;
  const discoveryIssuer = coBrand?.bankIssuer ?? issuer;

  const queries = [
    `site:cdn.prodstatic.com "${discoveryIssuer}" "${core}" card ${neg}`.trim(),
    ...(issuerHost
      ? [`site:${issuerHost} "${core}" card art png ${neg}`.trim()]
      : []),
    ...(coBrand ? coBrandImageSearchQueries({ issuer, cardName, coBrand }) : []),
    `${discoveryIssuer} "${core}" credit card official card art png ${neg}`.trim(),
    `"${core}" credit card png site:creditcards.com OR site:americanexpress.com OR site:citi.com ${neg}`.trim(),
  ].filter((q): q is string => Boolean(q));

  const scored = new Map<
    string,
    { score: number; title: string; rank: number }
  >();
  let resultIndex = 0;

  for (const q of queries) {
    const hits = await fetchSerpApiImageHits(q, { num: 15 });
    for (const hit of hits) {
      const prev = scored.get(hit.url);
      const nextScore = scoreSearchImageHit(
        hit.url,
        hit.title,
        { issuer, cardName, productSlug: slug || cardName.replace(/\s+/g, "-") },
        resultIndex++,
        { width: hit.width, height: hit.height },
      );
      if (!prev || nextScore > prev.score) {
        scored.set(hit.url, {
          score: nextScore,
          title: hit.title,
          rank: hit.rank,
        });
      }
    }
  }

  return [...scored.entries()]
    .filter(([, v]) => v.score >= 25)
    .sort((a, b) => b[1].score - a[1].score || a[1].rank - b[1].rank)
    .map(([url, v]) => ({
      url,
      title: v.title,
      rank: v.rank,
      score: v.score,
    }));
}
