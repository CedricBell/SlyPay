import { discoverIntelViaCardProductPage } from "@/server/card-intelligence/issuer-card-page-discovery";
import type { IntelDocumentKind } from "@/server/card-intelligence/discover-official-pdf-url";
import { classifyIntelDocumentIntent } from "@/server/card-intelligence/intel-document-intent";
import {
  pickFirstReachableIntelUrl,
  probeIntelDocumentUrl,
} from "@/server/card-intelligence/intel-document-probe";
import {
  isAncillaryIssuerFeaturePath,
  isIssuerLegalHubListingPath,
} from "@/server/card-intelligence/intel-path-bonus";
import {
  amexMarketingUrlCandidates,
  guessIssuerProductPageUrls,
} from "@/server/card-intelligence/issuer-product-url-guess";
import { resolveIntelDiscoveryHosts } from "@/server/card-intelligence/co-brand-discovery";
import { siblingSlugExclusionTerms } from "@/server/card-intelligence/pdf-discovery-query";
import {
  isGenericIssuerCardHub,
  scoreIntelProductPageUrl,
} from "@/server/card-intelligence/intel-source-url-quality";

function isUnacceptableIntelDocumentUrl(url: string): boolean {
  return (
    isAncillaryIssuerFeaturePath(url) ||
    isIssuerLegalHubListingPath(url) ||
    isGenericIssuerCardHub(url)
  );
}

/** Marketing landing pages — use as intel source (offer overlay / page copy). */
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
    if (/capitalone\.com/i.test(u.hostname)) {
      return /\/credit-cards\/[^/]+\/?$/i.test(path) && !/\/apply\b/i.test(path);
    }
    if (/apple\.com/i.test(u.hostname)) {
      return /\/apple-card/i.test(path);
    }
    if (/usbank\.com/i.test(u.hostname)) {
      return /\/credit-cards?\//i.test(path);
    }
    if (/amazon\.com/i.test(u.hostname)) {
      return (
        /\/dp\/[a-z0-9]{8,}/i.test(path) ||
        /\/gp\/product\//i.test(path) ||
        /Synchrony-Bank-/i.test(path)
      );
    }
    if (/paypal\.com/i.test(u.hostname)) {
      return /\/digital-wallet\/manage-money\//i.test(path);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Normalize discovered URL: keep reachable marketing pages (Amex/Chase/Capital One).
 * Never append `/apply/terms/` without a successful probe — that path often 404s.
 */
export async function refineIntelDocumentUrl(args: {
  url: string | null;
  issuer: string;
  cardName: string;
  productSlug: string;
}): Promise<{ url: string | null; sourceKind: IntelDocumentKind | null }> {
  if (!args.url) return { url: null, sourceKind: null };

  const probe = await probeIntelDocumentUrl(args.url);
  if (!probe.reachable) {
    const fallbacks = [
      ...guessIssuerProductPageUrls(args.issuer, args.productSlug, args.cardName),
      ...amexMarketingUrlCandidates(args.productSlug, args.cardName),
    ];
    const picked = await pickFirstReachableIntelUrl(fallbacks);
    if (picked) {
      return { url: picked.url, sourceKind: picked.kind };
    }
    return { url: null, sourceKind: null };
  }

  if (isIssuerProductLandingUrl(args.url)) {
    return { url: args.url, sourceKind: "html" };
  }

  if (
    scoreIntelProductPageUrl(args.url, args.productSlug, args.cardName) >= 70
  ) {
    return { url: args.url, sourceKind: probe.kind };
  }

  const intent = classifyIntelDocumentIntent(args.url);
  const needsRefine =
    isAncillaryIssuerFeaturePath(args.url) ||
    (intent === "neutral" &&
      !args.url.toLowerCase().includes("pricingandterms"));

  if (!needsRefine) {
    return { url: args.url, sourceKind: probe.kind };
  }

  const discovery = await resolveIntelDiscoveryHosts(
    args.issuer,
    args.cardName,
    args.productSlug,
  );
  const exclusionTerms = siblingSlugExclusionTerms(
    discovery.issuerForDiscovery,
    args.productSlug,
  );
  const discovered = await discoverIntelViaCardProductPage({
    hosts: discovery.hosts,
    cardName: discovery.cardNameForDiscovery,
    issuer: discovery.issuerForDiscovery,
    productSlug: args.productSlug,
    exclusionTerms,
    coBrand: discovery.coBrand,
  });

  if (discovered?.url && !isUnacceptableIntelDocumentUrl(discovered.url)) {
    const dProbe = await probeIntelDocumentUrl(discovered.url);
    if (dProbe.reachable) {
      return { url: discovered.url, sourceKind: discovered.sourceKind };
    }
  }

  const reachable = await pickFirstReachableIntelUrl(
    guessIssuerProductPageUrls(args.issuer, args.productSlug, args.cardName),
  );
  if (reachable) {
    return { url: reachable.url, sourceKind: reachable.kind };
  }

  return { url: args.url, sourceKind: probe.kind };
}
