/** Index of all consumer card agreements (not one product’s rewards/terms). */
export function isIssuerLegalHubListingPath(urlOrPath: string): boolean {
  const p = urlOrPath.toLowerCase();
  return (
    /\/company\/legal\//i.test(p) ||
    /cardmember-agreements/i.test(p) ||
    /legalfooter_card_agreements/i.test(p)
  );
}

import {
  isGenericIssuerCardHub,
  isGenericIssuerDisclosureDocument,
  isIntelSourceCategoryHub,
  isIssuerApplyFormUrl,
  isThirdPartyIntelHost,
} from "@/server/card-intelligence/intel-source-url-quality";

/** Non-card pages (credit score, lounge guides, legal index, etc.) — not product intel sources. */
export function isAncillaryIssuerFeaturePath(urlOrPath: string): boolean {
  const p = urlOrPath.toLowerCase();
  if (isIntelSourceCategoryHub(urlOrPath)) return true;
  if (isGenericIssuerCardHub(urlOrPath)) return true;
  if (isIssuerApplyFormUrl(urlOrPath)) return true;
  if (isGenericIssuerDisclosureDocument(urlOrPath)) return true;
  try {
    if (isThirdPartyIntelHost(new URL(urlOrPath).hostname)) return true;
  } catch {
    /* */
  }
  if (isIssuerLegalHubListingPath(p)) return true;
  if (
    /features-benefits|free-credit-score|mycreditguide|unifiedlandingpage|credit-score\/terms|identity-monitoring|global-lounge|membership-rewards\/terms/i.test(
      p,
    )
  ) {
    return true;
  }
  if (
    /\/terms-and-conditions/i.test(p) &&
    !/\/credit-cards\/card\//i.test(p) &&
    !/\/apply\/terms/i.test(p)
  ) {
    return true;
  }
  return false;
}

/** Issuer marketing product page (e.g. Amex `/card/platinum/`). */
export function isIssuerCardProductMarketingPath(
  hostname: string,
  pathname: string,
): boolean {
  const path = pathname.toLowerCase();
  if (/americanexpress\.com/i.test(hostname)) {
    return /\/credit-cards\/card\/[^/]+\/?$/i.test(path);
  }
  if (/creditcards\.chase\.com/i.test(hostname)) {
    return /\/(rewards-credit-cards|cash-back-credit-cards)\/[^/]+\/[^/]+\/?$/i.test(
        path,
      ) && !/pricing|terms|rules/i.test(path);
  }
  if (/apple\.com/i.test(hostname)) {
    return /\/apple-card/i.test(path);
  }
  if (/paypal\.com/i.test(hostname)) {
    return (
      /\/digital-wallet\/manage-money\//i.test(path) &&
      /(cashback|mastercard|credit-card)/i.test(path)
    );
  }
  return false;
}

/**
 * Boosts official issuer-hosted **HTML** terms / disclosures in discovery ranking.
 * Many issuers (e.g. Amex) publish rewards in `/apply/terms/...` pages, not PDFs.
 */
export function pathBonusForIntelDocument(url: URL): number {
  const p = (url.pathname + url.search).toLowerCase();
  let b = 0;

  if (isAncillaryIssuerFeaturePath(p)) {
    return -120;
  }

  if (isIssuerCardProductMarketingPath(url.hostname, url.pathname)) {
    b += 72;
  }
  if (/usbank\.com/i.test(url.hostname) && /\/credit-cards\/.*\.html/i.test(p)) {
    b += 65;
  }
  if (/paypal\.com/i.test(url.hostname) && /\/digital-wallet\//i.test(p)) {
    b += 48;
  }

  if (p.includes("/apply/terms")) {
    b += 58;
  } else if (p.includes("/terms-and-conditions")) {
    b += 38;
  } else if (p.includes("/terms") || p.includes("terms-of-use")) {
    b += 42;
  }
  if (
    /(disclosure|disclosures|fee-table|benefits-summary|rewards-disclosure)/i.test(
      p,
    )
  ) {
    b += 24;
  }
  if (/cardmember/i.test(p) && !isIssuerLegalHubListingPath(p)) {
    b += 18;
  }
  if (/(pricingandterms|pricing-and-terms)/i.test(p)) {
    b += 8;
  }
  if (/\/dam\/pricingandterms\//i.test(p)) {
    b += 10;
  }
  if (/#offer(pop|details?)/i.test(p) || /offerpop|offer-detail/i.test(p)) {
    b += 42;
  }
  if (/(rewards|earning|points-per|cash-back|cashback)/i.test(p)) {
    b += 12;
  }
  if (p.endsWith(".pdf")) {
    b += 8;
  }

  if (
    /(\/login|\/signin|\/sign-in|\/oauth|\/register\/|\/account\/|\/auth\/)/i.test(
      p,
    )
  ) {
    b -= 90;
  }

  return b;
}

/** Prefer these as HTML intel sources (path signal, not content-type). */
export function looksLikeOfficialTermsHtmlPath(url: URL): boolean {
  if (url.pathname.toLowerCase().endsWith(".pdf")) return false;
  return pathBonusForIntelDocument(url) >= 22;
}
