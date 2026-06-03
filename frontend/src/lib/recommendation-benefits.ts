import { EarningType, SpendCategory } from "@prisma/client";
import {
  rewardsExtractSchema,
  type RewardsExtract,
} from "@/server/card-intelligence/rewards-extract-schema";
import { isMerchantExcluded } from "@/server/merchant-exclusions";
import { categoryLabelFromUi } from "@/lib/spend-category-ui";

/** Fixed reference for %-based ranking (purchase size does not change the winner). */
export const REFERENCE_PURCHASE_USD = 100;

const CATEGORY_KEYWORDS: Record<SpendCategory, string[]> = {
  GROCERIES: ["grocery", "groceries", "supermarket", "grocery store"],
  DINING: ["dining", "restaurant", "food", "eat", "drink"],
  TRAVEL: [
    "travel",
    "hotel",
    "lodging",
    "flight",
    "airline",
    "airport",
    "resort",
    "hilton",
    "marriott",
    "hyatt",
    "booking",
  ],
  GAS: ["gas", "fuel", "gasoline", "service station"],
  ONLINE_SHOPPING: ["online", "e-commerce", "internet", "amazon"],
  DRUGSTORES: ["drugstore", "pharmacy", "drug store"],
  ENTERTAINMENT: ["entertainment", "streaming", "movie", "theater"],
  WHOLESALE: ["wholesale", "warehouse", "costco", "sam's"],
  OTHER: ["other", "everyday", "all purchases", "all other"],
};

const PROTECTION_CONTEXT_KEYWORDS: Record<string, string[]> = {
  PHONE: ["phone", "mobile", "cell", "wireless", "apple", "samsung", "electronics"],
  TRAVEL: ["travel", "trip", "flight", "hotel", "vacation"],
  PURCHASE: ["purchase", "buy", "checkout", "retail", "store"],
  RENTAL_CAR: ["rental car", "car rental", "hertz", "avis", "enterprise"],
};

export function formatRateLabel(
  multiplier: number,
  earningType: EarningType | string,
): string {
  if (earningType === EarningType.CASHBACK_PERCENT) {
    return `${multiplier}% cash back`;
  }
  if (earningType === EarningType.MILES) {
    return `${multiplier}× miles`;
  }
  return `${multiplier}× points`;
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function merchantTokens(merchantName: string | null | undefined): string[] {
  if (!merchantName?.trim()) return [];
  return normalizeText(merchantName)
    .split(" ")
    .filter((t) => t.length > 2);
}

function textMatchesMerchant(text: string, merchantName: string | null | undefined): boolean {
  const blob = normalizeText(text);
  if (!blob) return false;
  const tokens = merchantTokens(merchantName);
  if (tokens.length === 0) return false;
  return tokens.some((t) => blob.includes(t));
}

function textMatchesCategory(text: string, category: SpendCategory): boolean {
  const blob = normalizeText(text);
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  return keywords.some((k) => blob.includes(k));
}

export function parseCatalogRewardsExtract(json: unknown): RewardsExtract | null {
  if (json == null) return null;
  try {
    return rewardsExtractSchema.parse(json);
  } catch {
    return null;
  }
}

export type SpendBenefitCredit = {
  description: string;
  amountText: string | null;
  cadence: string | null;
  merchantHint: string | null;
  enrollmentRequired: boolean;
};

export type SpendBenefitProtection = {
  kind: string;
  title: string;
  coverageSummary: string;
  limitsText: string | null;
};

export type SpendBenefitPerk = {
  title: string;
  description: string;
};

export type CardSpendBenefits = {
  rateLabel: string;
  categoryEarnLines: string[];
  statementCredits: SpendBenefitCredit[];
  protections: SpendBenefitProtection[];
  perks: SpendBenefitPerk[];
  welcomeOffer: string | null;
  loyaltyPerks: string[];
  relevantCaveats: string[];
  merchantExclusionNotes: string[];
  benefitsSummary: string | null;
  summarySnippet: string | null;
};

function protectionRelevant(
  p: SpendBenefitProtection,
  category: SpendCategory,
  merchantName: string | null | undefined,
): boolean {
  const blob = `${p.title} ${p.coverageSummary} ${p.kind}`.toLowerCase();
  if (textMatchesCategory(blob, category) || textMatchesMerchant(blob, merchantName)) {
    return true;
  }
  const keywords = PROTECTION_CONTEXT_KEYWORDS[p.kind] ?? [];
  const merchantBlob = normalizeText(merchantName ?? "");
  if (keywords.some((k) => merchantBlob.includes(k) || blob.includes(k))) return true;
  if (p.kind === "PURCHASE" || p.kind === "EXTENDED_WARRANTY" || p.kind === "RETURN") {
    return true;
  }
  return category === SpendCategory.TRAVEL && p.kind === "TRAVEL";
}

export function buildCardSpendBenefits(args: {
  extractJson: unknown;
  category: SpendCategory;
  merchantName?: string | null;
  effectiveMultiplier: number;
  earningType: EarningType | string;
  engineLines: string[];
  merchantExcluded?: boolean;
  ruleExcludedMerchants?: string[];
}): CardSpendBenefits {
  const extract = parseCatalogRewardsExtract(args.extractJson);
  const catLabel = categoryLabelFromUi(args.category);
  const rateLabel = `${formatRateLabel(args.effectiveMultiplier, args.earningType)} on ${catLabel.toLowerCase()}`;

  const categoryEarnLines: string[] = [];
  const statementCredits: SpendBenefitCredit[] = [];
  const protections: SpendBenefitProtection[] = [];
  const perks: SpendBenefitPerk[] = [];
  const loyaltyPerks: string[] = [];
  const relevantCaveats: string[] = [];
  const merchantExclusionNotes: string[] = [];

  if (args.merchantExcluded && args.merchantName) {
    merchantExclusionNotes.push(
      `${args.merchantName} does not earn the ${catLabel.toLowerCase()} bonus on this card — base rate applies.`,
    );
  } else if (
    args.merchantName &&
    args.ruleExcludedMerchants?.length &&
    isMerchantExcluded(args.merchantName, args.ruleExcludedMerchants)
  ) {
    merchantExclusionNotes.push(
      `${args.merchantName} is excluded from ${catLabel.toLowerCase()} bonus categories.`,
    );
  }

  if (extract) {
    for (const rate of extract.earnRates) {
      const hint = rate.categoryHint ?? "";
      const desc = rate.multiplierDescription ?? "";
      const notes = rate.notes ?? "";
      const exclusions = rate.excludedMerchants ?? [];
      const blob = `${hint} ${desc} ${notes}`;

      if (
        textMatchesCategory(blob, args.category) ||
        textMatchesMerchant(blob, args.merchantName)
      ) {
        let line = desc.trim() || hint.trim();
        if (exclusions.length) {
          line += ` (excludes ${exclusions.slice(0, 4).join(", ")}${exclusions.length > 4 ? "…" : ""})`;
        }
        if (notes.trim()) line += ` — ${notes.trim()}`;
        if (line && !categoryEarnLines.includes(line)) {
          categoryEarnLines.push(line);
        }
      }
    }

    for (const sc of extract.statementCredits) {
      const blob = `${sc.description} ${sc.amountText ?? ""} ${sc.cadence ?? ""} ${sc.merchantHint ?? ""} ${sc.categoryHint ?? ""}`;
      const merchantMatch =
        sc.merchantHint && args.merchantName
          ? textMatchesMerchant(sc.merchantHint, args.merchantName) ||
            textMatchesMerchant(blob, args.merchantName)
          : textMatchesMerchant(blob, args.merchantName);

      if (
        textMatchesCategory(blob, args.category) ||
        merchantMatch ||
        (args.category === SpendCategory.TRAVEL &&
          /\b(hotel|resort|lodging|airline|travel|property|hilton|marriott)\b/i.test(blob))
      ) {
        statementCredits.push({
          description: sc.description.trim(),
          amountText: sc.amountText?.trim() ?? null,
          cadence: sc.cadence?.trim() ?? null,
          merchantHint: sc.merchantHint?.trim() ?? null,
          enrollmentRequired: sc.enrollmentRequired ?? false,
        });
      }
    }

    if (
      statementCredits.length === 0 &&
      extract.statementCredits.length > 0 &&
      (args.category === SpendCategory.TRAVEL || args.merchantName)
    ) {
      for (const sc of extract.statementCredits.slice(0, 6)) {
        statementCredits.push({
          description: sc.description.trim(),
          amountText: sc.amountText?.trim() ?? null,
          cadence: sc.cadence?.trim() ?? null,
          merchantHint: sc.merchantHint?.trim() ?? null,
          enrollmentRequired: sc.enrollmentRequired ?? false,
        });
      }
    }

    for (const p of extract.protections ?? []) {
      const item: SpendBenefitProtection = {
        kind: p.kind,
        title: p.title.trim(),
        coverageSummary: p.coverageSummary.trim(),
        limitsText: p.limitsText?.trim() ?? null,
      };
      if (protectionRelevant(item, args.category, args.merchantName)) {
        protections.push(item);
      }
    }

    for (const perk of extract.perks ?? []) {
      const blob = `${perk.title} ${perk.description} ${perk.categoryHint ?? ""}`;
      if (
        textMatchesCategory(blob, args.category) ||
        textMatchesMerchant(blob, args.merchantName) ||
        protections.length === 0
      ) {
        perks.push({
          title: perk.title.trim(),
          description: perk.description.trim(),
        });
      }
    }

    if (extract.loyaltyProgramNotes?.trim()) {
      loyaltyPerks.push(extract.loyaltyProgramNotes.trim());
    }

    for (const c of extract.caveats) {
      const t = String(c).trim();
      if (!t) continue;
      if (
        textMatchesCategory(t, args.category) ||
        textMatchesMerchant(t, args.merchantName) ||
        (args.merchantName && /\b(exclud|not eligible|does not qualify)\b/i.test(t))
      ) {
        relevantCaveats.push(t);
      }
    }
  }

  if (categoryEarnLines.length === 0) {
    categoryEarnLines.push(
      `${formatRateLabel(args.effectiveMultiplier, args.earningType)} (${catLabel})`,
    );
  }

  for (const line of args.engineLines) {
    if (
      line.includes("promo") ||
      line.includes("cap") ||
      line.includes("Active") ||
      line.includes("Excludes:") ||
      line.includes("excluded")
    ) {
      if (!categoryEarnLines.includes(line)) categoryEarnLines.push(line);
    }
  }

  const welcomeOffer = extract?.welcomeOffer?.description?.trim()
    ? [
        extract.welcomeOffer.description.trim(),
        extract.welcomeOffer.amountText,
        extract.welcomeOffer.spendRequirement,
        extract.welcomeOffer.timeframe,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const benefitsSummary =
    extract?.benefitsSummary?.trim() ??
    (protections.length
      ? `${protections.length} purchase/travel protection${protections.length > 1 ? "s" : ""} on this card.`
      : null);

  const summarySnippet = extract?.summary
    ? extract.summary.trim().slice(0, 320)
    : null;

  return {
    rateLabel,
    categoryEarnLines,
    statementCredits,
    protections,
    perks,
    welcomeOffer,
    loyaltyPerks,
    relevantCaveats,
    merchantExclusionNotes,
    benefitsSummary,
    summarySnippet,
  };
}

export function formatStatementCreditLine(c: SpendBenefitCredit): string {
  const parts = [c.description];
  if (c.amountText) parts.push(c.amountText);
  if (c.merchantHint) parts.push(`@${c.merchantHint}`);
  if (c.cadence) parts.push(`(${c.cadence})`);
  if (c.enrollmentRequired) parts.push("(enrollment required)");
  return parts.join(" · ");
}

export function formatProtectionLine(p: SpendBenefitProtection): string {
  const parts = [p.title, p.coverageSummary];
  if (p.limitsText) parts.push(`Limits: ${p.limitsText}`);
  return parts.join(" — ");
}
