import { hostnameMatchesIssuer } from "@/server/card-intelligence/issuer-official-domains";
import { resolveIssuerCrawlOrigins } from "@/server/card-intelligence/issuer-crawl-origins";
import { guessIssuerProductPageUrls } from "@/server/card-intelligence/issuer-product-url-guess";
import {
  extractAnchorLinks,
  extractHttpsLinks,
  fetchIssuerHtml,
  type AnchorLink,
} from "@/server/card-intelligence/issuer-html-links";
import {
  classifyIntelDocumentIntent,
  intentSortRank,
  normalizeIntelDocumentFetchUrl,
  scoreRewardRichnessInPlainText,
} from "@/server/card-intelligence/intel-document-intent";
import { htmlDocumentToPlainText } from "@/server/card-intelligence/html-to-intel-text";
import {
  looksLikeOfficialTermsHtmlPath,
  pathBonusForIntelDocument,
} from "@/server/card-intelligence/intel-path-bonus";
import { scorePdfCandidate } from "@/server/card-intelligence/pdf-discovery-query";

type IntelDocumentKind = "pdf" | "html";

const HUB_PATHS = [
  "/",
  "/rewards-credit-cards/",
  "/cash-back-credit-cards/",
  "/en-us/credit-cards/",
  "/credit-cards/",
  "/personal/credit-cards",
  "/personal/credit-cards/",
];

const MAX_HUB_FETCHES = 8;
const MAX_PRODUCT_PAGES = 6;

const REWARDS_RULES_ANCHOR = [
  /rewards?\s*(and|&|\/)\s*rules?/i,
  /rules?\s*(and|&)\s*rewards?/i,
  /rates?\s*(and|&)\s*fees?/i,
  /pricing\s*(and|&)\s*terms?/i,
  /terms?\s*(and|&)\s*conditions?/i,
  /cardmember\s+agreement/i,
  /benefits?\s+(and|&)\s+terms?/i,
  /rewards?\s+terms?/i,
  /view\s+rewards?/i,
  /see\s+rewards?/i,
  /offer\s+details/i,
  /schumer/i,
  /fee\s+table/i,
  /pricing\s+information/i,
];

const TRAVEL_HUB_PATH =
  /(\/travel\b|\/home\/travel|travel-offers|\/travel-|\/en-us\/travel|\/us\/travel)/i;

const REWARDS_RULES_PATH =
  /(rewards[-_]and[-_]rules|rates[-_]and[-_]fees|pricingandterms|pricing[-_]and[-_]terms|cardmember|\/apply\/terms\/|benefits?[-_]summary|rewards?[-_]disclosure|\/dam\/pricingandterms\/|LGC\d+\.html)/i;

const LOGIN_PATH =
  /(\/login|\/signin|\/sign-in|\/oauth|\/register\/|\/account\/|\/auth\/)/i;

function isBusinessCardProduct(slug: string, cardName: string): boolean {
  const blob = `${slug} ${cardName}`.toLowerCase();
  return /\bbusiness\b|\bcorporate\b/.test(blob);
}

function slugTokens(cardName: string, productSlug: string): string[] {
  const fromSlug = productSlug
    .replace(/^adhoc-[a-f0-9]+$/, "")
    .split("-")
    .filter((t) => t.length >= 2);
  const fromName = cardName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(
      (t) =>
        t.length >= 2 &&
        !["card", "credit", "visa", "mastercard", "rewards"].includes(t),
    );
  return [...new Set([...fromSlug, ...fromName])];
}

function looksLikeRewardsRulesLink(link: AnchorLink): boolean {
  const blob = `${link.anchorText} ${link.url}`.toLowerCase();
  if (REWARDS_RULES_ANCHOR.some((re) => re.test(blob))) return true;
  try {
    const u = new URL(link.url);
    const p = u.pathname + u.search;
    return REWARDS_RULES_PATH.test(p);
  } catch {
    return false;
  }
}

function scoreProductPageUrl(
  raw: string,
  args: {
    cardName: string;
    issuer: string;
    productSlug: string;
    exclusionTerms: string[];
    tokens: string[];
  },
): number {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return -1;
  }
  const pathL = (u.pathname + u.search).toLowerCase();
  if (LOGIN_PATH.test(pathL)) return -1;
  if (pathL.endsWith(".pdf")) return -1;
  if (TRAVEL_HUB_PATH.test(pathL)) return -1;

  let s = scorePdfCandidate({
    url: raw,
    hint: "",
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms: args.exclusionTerms,
    resultIndex: 0,
  });

  const tokenHits = args.tokens.filter((t) => pathL.includes(t)).length;
  s += tokenHits * 24;

  if (/rewards-credit-cards|cash-back-credit-cards|\/credit-cards?\//i.test(pathL)) {
    s += 45;
  }
  if (/rewards-credit-cards/i.test(pathL)) {
    s += 40;
  }
  if (
    /business-credit-cards|\/business\//i.test(pathL) &&
    !isBusinessCardProduct(args.productSlug, args.cardName)
  ) {
    s -= 100;
  }

  if (looksLikeOfficialTermsHtmlPath(u) || REWARDS_RULES_PATH.test(pathL)) {
    s -= 50;
  }

  return s;
}

function scoreRewardsRulesTarget(
  raw: string,
  hint: string,
  args: {
    cardName: string;
    issuer: string;
    productSlug: string;
    exclusionTerms: string[];
  },
): number {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return -1;
  }
  if (LOGIN_PATH.test(u.pathname)) return -1;
  const pathL = (u.pathname + u.search).toLowerCase();
  if (TRAVEL_HUB_PATH.test(pathL)) return -1;

  let s =
    scorePdfCandidate({
      url: raw,
      hint,
      cardName: args.cardName,
      issuer: args.issuer,
      productSlug: args.productSlug,
      exclusionTerms: args.exclusionTerms,
      resultIndex: 0,
    }) + pathBonusForIntelDocument(u);

  const intent = classifyIntelDocumentIntent(raw, hint);
  if (looksLikeRewardsRulesLink({ url: raw, anchorText: hint })) {
    s += intent === "pricing_legal" ? 35 : 95;
  }
  if (intent === "offer_rewards") {
    s += 130;
  } else if (intent === "pricing_legal") {
    s -= 65;
  }
  if (TRAVEL_HUB_PATH.test(pathL)) {
    s -= 150;
  }
  if (/#offerpop/i.test(raw)) {
    s += 85;
  }
  return s;
}

async function inferKind(url: string): Promise<IntelDocumentKind> {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const ct = head.headers.get("content-type") ?? "";
    if (ct.toLowerCase().includes("application/pdf")) return "pdf";
  } catch {
    /* */
  }
  return "html";
}

function productPageHasOfferDetailsOverlay(html: string): boolean {
  return (
    /#offerpop|id=["']offerpop|begin\s+offer\s+details|offer\s+details\s+overlay/i.test(
      html,
    ) || /\boffer\s+details\b/i.test(html)
  );
}

function collectRulesFromHtml(
  html: string,
  pageUrl: string,
  hosts: string[],
  scoreArgs: {
    cardName: string;
    issuer: string;
    productSlug: string;
    exclusionTerms: string[];
  },
): Array<{ url: string; score: number }> {
  const base = new URL(pageUrl);
  const rulesTargets: Array<{ url: string; score: number }> = [];
  const productFetchUrl = normalizeIntelDocumentFetchUrl(pageUrl);

  if (productPageHasOfferDetailsOverlay(html)) {
    const sc =
      scoreRewardsRulesTarget(
        productFetchUrl,
        "offer details",
        scoreArgs,
      ) + 60;
    rulesTargets.push({ url: productFetchUrl, score: sc });
  }

  for (const link of extractAnchorLinks(html, base)) {
    let host: string;
    try {
      host = new URL(link.url).hostname;
    } catch {
      continue;
    }
    if (!hostnameMatchesIssuer(host, hosts)) continue;
    if (!looksLikeRewardsRulesLink(link)) continue;
    const sc = scoreRewardsRulesTarget(link.url, link.anchorText, scoreArgs);
    if (sc >= 35) rulesTargets.push({ url: link.url, score: sc });
  }

  return rulesTargets;
}

async function pickBestRulesTarget(
  targets: Array<{ url: string; score: number }>,
): Promise<{ url: string; score: number } | null> {
  if (!targets.length) return null;

  const byFetchUrl = new Map<string, { url: string; score: number }>();
  for (const t of targets) {
    const key = normalizeIntelDocumentFetchUrl(t.url);
    const prev = byFetchUrl.get(key);
    if (!prev || t.score > prev.score) {
      byFetchUrl.set(key, { url: key, score: t.score });
    }
  }

  const unique = [...byFetchUrl.values()].sort((a, b) => {
    const ia = intentSortRank(classifyIntelDocumentIntent(a.url));
    const ib = intentSortRank(classifyIntelDocumentIntent(b.url));
    if (ia !== ib) return ib - ia;
    return b.score - a.score;
  });

  const hasOfferCandidate = unique.some(
    (t) => classifyIntelDocumentIntent(t.url) === "offer_rewards",
  );

  let best = unique[0];
  let bestCombined = -Infinity;

  for (const t of unique.slice(0, 6)) {
    const intent = classifyIntelDocumentIntent(t.url);
    if (
      intent === "pricing_legal" &&
      hasOfferCandidate &&
      t.score < unique[0]!.score + 40
    ) {
      continue;
    }

    const path = new URL(t.url).pathname.toLowerCase();
    let combined = t.score;
    if (!path.endsWith(".pdf")) {
      const html = await fetchIssuerHtml(normalizeIntelDocumentFetchUrl(t.url));
      if (html) {
        combined += scoreRewardRichnessInPlainText(htmlDocumentToPlainText(html));
      }
    } else if (intent === "pricing_legal") {
      combined -= 40;
    }

    if (combined > bestCombined) {
      bestCombined = combined;
      best = t;
    }
  }

  return best;
}

/**
 * Issuer-site flow: guessed product URL (catalog slug) → optional hub crawl →
 * « Pricing & Terms » / pricingandterms HTML on issuer domains.
 */
export async function discoverIntelViaCardProductPage(args: {
  hosts: string[];
  cardName: string;
  issuer: string;
  productSlug: string;
  exclusionTerms: string[];
}): Promise<{ url: string; sourceKind: IntelDocumentKind } | null> {
  const tokens = slugTokens(args.cardName, args.productSlug);
  const scoreArgs = {
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms: args.exclusionTerms,
    tokens,
  };

  const productPages = new Map<string, number>();

  for (const guessed of guessIssuerProductPageUrls(
    args.issuer,
    args.productSlug,
    args.cardName,
  )) {
    productPages.set(guessed, 175);
  }

  let hubFetches = 0;
  const origins = resolveIssuerCrawlOrigins(args.issuer);

  for (const origin of origins) {
    if (hubFetches >= MAX_HUB_FETCHES) break;
    let base: URL;
    try {
      base = new URL(origin);
    } catch {
      continue;
    }

    const pathsToTry =
      origin.includes("creditcards.") && args.issuer.toLowerCase().includes("chase")
        ? ["/rewards-credit-cards/", "/", ...HUB_PATHS]
        : HUB_PATHS;

    for (const path of pathsToTry) {
      if (hubFetches >= MAX_HUB_FETCHES) break;
      const hubUrl = new URL(path, base).toString();
      const html = await fetchIssuerHtml(hubUrl);
      hubFetches += 1;
      if (!html) continue;

      for (const raw of extractHttpsLinks(html, base)) {
        let u: URL;
        try {
          u = new URL(raw);
        } catch {
          continue;
        }
        if (!hostnameMatchesIssuer(u.hostname, args.hosts)) continue;
        const sc = scoreProductPageUrl(raw, scoreArgs);
        if (sc < 12) continue;
        const prev = productPages.get(raw) ?? -1;
        if (sc > prev) productPages.set(raw, sc);
      }
    }
  }

  const rankedProducts = [...productPages.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PRODUCT_PAGES);

  const rulesTargets: Array<{ url: string; score: number }> = [];

  for (const [productUrl] of rankedProducts) {
    const html = await fetchIssuerHtml(productUrl);
    if (!html) continue;
    rulesTargets.push(...collectRulesFromHtml(html, productUrl, args.hosts, scoreArgs));
  }

  const best = await pickBestRulesTarget(rulesTargets);
  if (!best) return null;

  const sourceKind = await inferKind(best.url);
  return { url: best.url, sourceKind };
}
