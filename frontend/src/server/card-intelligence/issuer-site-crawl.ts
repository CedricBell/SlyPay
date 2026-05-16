import { hostnameMatchesIssuer } from "@/server/card-intelligence/issuer-official-domains";
import { resolveIssuerCrawlOrigins } from "@/server/card-intelligence/issuer-crawl-origins";
import {
  extractHttpsLinks,
  fetchIssuerHtml,
} from "@/server/card-intelligence/issuer-html-links";
import {
  pathBonusForIntelDocument,
  looksLikeOfficialTermsHtmlPath,
} from "@/server/card-intelligence/intel-path-bonus";
import { scorePdfCandidate } from "@/server/card-intelligence/pdf-discovery-query";

export type IssuerSiteHit = { url: string; hint: string };

const HUB_PATHS: string[] = [
  "/en-us/credit-cards/",
  "/credit-cards/",
  "/personal/credit-cards",
  "/personal/credit-cards/",
  "/credit-cards",
  "/cards/",
];

const MAX_HUB_FETCHES = 4;
const MAX_LINKS_PER_HUB = 80;

function slugTokens(cardName: string, productSlug: string): string[] {
  const fromSlug = productSlug
    .replace(/^adhoc-[a-f0-9]+$/, "")
    .split("-")
    .filter((t) => t.length >= 3);
  const fromName = cardName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length >= 3 && !["card", "credit", "visa", "mastercard"].includes(t));
  return [...new Set([...fromSlug, ...fromName])];
}

/**
 * Fallback: collect terms/rewards URLs from issuer hub pages (no search engine).
 */
export async function harvestIssuerSiteLinks(args: {
  hosts: string[];
  cardName: string;
  issuer: string;
  productSlug: string;
  exclusionTerms: string[];
}): Promise<IssuerSiteHit[]> {
  const tokens = slugTokens(args.cardName, args.productSlug);
  const scored: Array<{ url: string; score: number }> = [];
  let fetches = 0;

  const origins = resolveIssuerCrawlOrigins(args.issuer);

  for (const origin of origins) {
    if (fetches >= MAX_HUB_FETCHES) break;
    let base: URL;
      try {
        base = new URL(origin);
      } catch {
        continue;
      }

      for (const path of HUB_PATHS) {
        if (fetches >= MAX_HUB_FETCHES) break;
        const hubUrl = new URL(path, base).toString();
        const html = await fetchIssuerHtml(hubUrl);
        fetches += 1;
        if (!html) continue;

        const links = extractHttpsLinks(html, new URL(hubUrl)).slice(
          0,
          MAX_LINKS_PER_HUB,
        );

        for (const raw of links) {
          let u: URL;
          try {
            u = new URL(raw);
          } catch {
            continue;
          }
          if (!hostnameMatchesIssuer(u.hostname, args.hosts)) continue;

          const pathL = (u.pathname + u.search).toLowerCase();
          const looksTerms =
            looksLikeOfficialTermsHtmlPath(u) ||
            pathL.includes("/terms") ||
            pathL.includes("benefit") ||
            pathL.includes("reward") ||
            pathL.endsWith(".pdf");

          if (!looksTerms) {
            const nameMatch = tokens.some((t) => pathL.includes(t));
            if (!nameMatch) continue;
          }

          const pb = pathBonusForIntelDocument(u);
          const baseScore = scorePdfCandidate({
            url: raw,
            hint: "",
            cardName: args.cardName,
            issuer: args.issuer,
            productSlug: args.productSlug,
            exclusionTerms: args.exclusionTerms,
            resultIndex: 0,
          });
          scored.push({ url: raw, score: baseScore + pb });
        }
      }
  }

  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const hits: IssuerSiteHit[] = [];
  for (const row of scored) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    hits.push({ url: row.url, hint: "issuer site hub" });
    if (hits.length >= 25) break;
  }
  return hits;
}
