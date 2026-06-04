import { discoverIntelViaCardProductPage } from "@/server/card-intelligence/issuer-card-page-discovery";
import type { IntelDocumentKind } from "@/server/card-intelligence/discover-official-pdf-url";
import { classifyIntelDocumentIntent } from "@/server/card-intelligence/intel-document-intent";
import {
  isAncillaryIssuerFeaturePath,
  isIssuerLegalHubListingPath,
} from "@/server/card-intelligence/intel-path-bonus";
import { guessIssuerProductPageUrls } from "@/server/card-intelligence/issuer-product-url-guess";

function isUnacceptableIntelDocumentUrl(url: string): boolean {
  return (
    isAncillaryIssuerFeaturePath(url) || isIssuerLegalHubListingPath(url)
  );
}
import { siblingSlugExclusionTerms } from "@/server/card-intelligence/pdf-discovery-query";
import { resolveIssuerOfficialHostsWithDb } from "@/server/card-intelligence/issuer-official-hosts";

/** Marketing landing pages are not sufficient — crawl for offer / terms HTML. */
export function isIssuerProductLandingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (path.endsWith(".pdf")) return false;
    if (/\/apply\/terms\//i.test(path)) return false;
    if (/\/dam\/pricingandterms\//i.test(path)) return false;
    if (/#offerpop/i.test(url)) return false;

    if (/americanexpress\.com/i.test(u.hostname)) {
      return /\/credit-cards\/card\/[^/]+\/?$/i.test(path);
    }
    if (/creditcards\.chase\.com/i.test(u.hostname)) {
      return (
        /\/(rewards-credit-cards|cash-back-credit-cards)\/[^/]+\/[^/]+\/?$/i.test(
          path,
        ) && !/pricing|terms|rules/i.test(path)
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * When the catalog stores a product marketing URL, discover the rewards/terms document
 * by crawling that product page (Amex offer overlay, Chase offer details, etc.).
 */
export async function refineIntelDocumentUrl(args: {
  url: string | null;
  issuer: string;
  cardName: string;
  productSlug: string;
}): Promise<{ url: string | null; sourceKind: IntelDocumentKind | null }> {
  if (!args.url) return { url: null, sourceKind: null };

  const intent = classifyIntelDocumentIntent(args.url);
  const needsRefine =
    isIssuerProductLandingUrl(args.url) ||
    isAncillaryIssuerFeaturePath(args.url) ||
    (intent === "neutral" && !args.url.toLowerCase().includes("pricingandterms"));

  if (!needsRefine) {
    return { url: args.url, sourceKind: null };
  }

  const hosts = await resolveIssuerOfficialHostsWithDb(args.issuer);
  const exclusionTerms = siblingSlugExclusionTerms(
    args.issuer,
    args.productSlug,
  );
  const discovered = await discoverIntelViaCardProductPage({
    hosts,
    cardName: args.cardName,
    issuer: args.issuer,
    productSlug: args.productSlug,
    exclusionTerms,
  });

  if (discovered?.url && !isUnacceptableIntelDocumentUrl(discovered.url)) {
    return { url: discovered.url, sourceKind: discovered.sourceKind };
  }

  if (/americanexpress\.com/i.test(args.url)) {
    const termsUrl = `${args.url.replace(/\/$/, "")}/apply/terms/`;
    return { url: termsUrl, sourceKind: "html" };
  }

  for (const productUrl of guessIssuerProductPageUrls(
    args.issuer,
    args.productSlug,
    args.cardName,
  )) {
    if (/americanexpress\.com/i.test(productUrl)) {
      const termsUrl = `${productUrl.replace(/\/$/, "")}/apply/terms/`;
      return { url: termsUrl, sourceKind: "html" };
    }
  }

  return { url: args.url, sourceKind: null };
}
