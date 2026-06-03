/**
 * Distinguish issuer docs that describe rewards/offer terms vs Schumer-style pricing-only pages
 * (e.g. Chase « Pricing & Terms » vs « Offer details » on the product page).
 */

export type IntelDocumentIntent = "offer_rewards" | "pricing_legal" | "neutral";

export function classifyIntelDocumentIntent(
  url: string,
  hint = "",
): IntelDocumentIntent {
  const blob = `${url} ${hint}`.toLowerCase();

  const isOffer =
    /#offer(pop|details?)\b/i.test(url) ||
    /\boffer\s*details?\b/i.test(blob) ||
    /offerpop|offer-detail|benefits?\s+summary|rewards?\s+disclosure|earning\s+in\s+the\s+rewards?\s+program/i.test(
      blob,
    );

  const isPricing =
    /pricing\s*(and|&)\s*terms?|pricingandterms|pricing-and-terms|pricing\s+information|\/dam\/pricingandterms\/|schumer|fee\s*table|lgc\d+\.html/i.test(
      blob,
    );

  if (isOffer && !(/pricing\s*(and|&)\s*terms?|pricingandterms/i.test(blob) && !/\boffer\b/i.test(blob))) {
    return "offer_rewards";
  }
  if (isPricing) return "pricing_legal";

  if (/\/travel\b|\/home\/travel|travel-offers|amextravel\.com/i.test(blob)) {
    return "pricing_legal";
  }

  if (
    /rewards?\s*(and|&)\s*rules?|rates?\s*(and|&)\s*fees?|cardmember\s+agreement/i.test(
      blob,
    )
  ) {
    return "neutral";
  }

  return "neutral";
}

export function intentSortRank(intent: IntelDocumentIntent): number {
  switch (intent) {
    case "offer_rewards":
      return 3;
    case "neutral":
      return 2;
    case "pricing_legal":
      return 1;
  }
}

/** URL used for HTTP fetch (fragments are not sent to servers). */
export function normalizeIntelDocumentFetchUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url.split("#")[0] ?? url;
  }
}

const REWARD_SIGNAL_RES =
  /\b(earn(?:ing)?\s+(?:\d+\s*)?(?:bonus\s+)?points?|\d+x\s+points?|points?\s+per\s+\$|cash\s*back|bonus\s+points?|rewards?\s+program|qualifying\s+purchases|category(?:ies)?)\b/gi;

const FEE_ONLY_SIGNAL_RES =
  /\b(annual\s+(?:membership\s+)?fee|penalty\s+apr|schumer|balance\s+transfer\s+fee|minimum\s+(?:interest\s+)?charge)\b/gi;

/**
 * Higher = more likely to contain extractable reward rules (plain text).
 */
export function scoreRewardRichnessInPlainText(text: string): number {
  const t = text.toLowerCase().slice(0, 90_000);
  let score = 0;
  score += (t.match(REWARD_SIGNAL_RES) ?? []).length * 4;
  score -= (t.match(FEE_ONLY_SIGNAL_RES) ?? []).length * 5;
  if (t.includes("earning in the rewards program")) score += 45;
  if (t.includes("offer details")) score += 30;
  if (t.includes("new cardmember")) score += 12;
  return score;
}

export function intentScoreAdjustment(intent: IntelDocumentIntent): number {
  switch (intent) {
    case "offer_rewards":
      return 28;
    case "pricing_legal":
      return -38;
    case "neutral":
      return 0;
  }
}

export function isTravelHubDocument(url: string): boolean {
  try {
    const p = new URL(url).pathname.toLowerCase();
    return /(\/travel\b|\/home\/travel|travel-offers|\/travel-)/i.test(p);
  } catch {
    return /travel/i.test(url);
  }
}
