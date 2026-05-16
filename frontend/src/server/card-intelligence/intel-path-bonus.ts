/**
 * Boosts official issuer-hosted **HTML** terms / disclosures in discovery ranking.
 * Many issuers (e.g. Amex) publish rewards in `/apply/terms/...` pages, not PDFs.
 */
export function pathBonusForIntelDocument(url: URL): number {
  const p = (url.pathname + url.search).toLowerCase();
  let b = 0;

  if (p.includes("/apply/terms") || p.includes("/terms-and-conditions")) {
    b += 58;
  } else if (p.includes("/terms") || p.includes("terms-of-use")) {
    b += 42;
  }
  if (
    /(disclosure|disclosures|cardmember|fee-table|benefits-summary|rewards-disclosure)/i.test(
      p,
    )
  ) {
    b += 24;
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
