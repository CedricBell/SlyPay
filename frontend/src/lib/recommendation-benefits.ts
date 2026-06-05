import { EarningType, SpendCategory } from "@prisma/client";
import {
  parseRewardsExtract,
  type RewardsExtract,
} from "@/server/card-intelligence/rewards-extract-schema";
import { isMerchantExcluded } from "@/server/merchant-exclusions";
import { categoryLabelFromUi } from "@/lib/spend-category-ui";
import { formatStatementCreditHint } from "@/lib/statement-credit-display";

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
    return parseRewardsExtract(json);
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
  if (category === SpendCategory.TRAVEL && p.kind === "TRAVEL") {
    return textMatchesCategory(blob, SpendCategory.TRAVEL);
  }
  if (p.kind === "RENTAL_CAR") {
    return (
      category === SpendCategory.TRAVEL ||
      textMatchesMerchant(blob, merchantName) ||
      /\b(rental|car rental)\b/i.test(blob)
    );
  }
  if (p.kind === "PHONE") {
    const phoneCtx = PROTECTION_CONTEXT_KEYWORDS.PHONE ?? [];
    const merchantBlob = normalizeText(merchantName ?? "");
    return phoneCtx.some((k) => merchantBlob.includes(k) || blob.includes(k));
  }
  return false;
}

function normalizeBenefitKey(text: string): string {
  return normalizeText(text).replace(/\s+/g, " ");
}

function lineDuplicatesRateLabel(line: string, rateLabel: string): boolean {
  const a = normalizeBenefitKey(line);
  const b = normalizeBenefitKey(rateLabel);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const multA = a.match(/(\d+(?:\.\d+)?)\s*%/);
  const multB = b.match(/(\d+(?:\.\d+)?)\s*%/);
  if (multA && multB && multA[1] === multB[1] && a.includes("cash back") && b.includes("cash back")) {
    return true;
  }
  return false;
}

function isDuplicateBenefitLine(line: string, seen: Set<string>, rateLabel: string): boolean {
  const key = normalizeBenefitKey(line);
  if (!key || seen.has(key)) return true;
  if (lineDuplicatesRateLabel(line, rateLabel)) return true;
  return false;
}

export type ContextualBenefitBullet = {
  group: "exclusion" | "earn" | "credit" | "protection" | "perk" | "loyalty" | "caveat";
  text: string;
};

type RotatingQuarterBullet = {
  label: string;
  multiplier: number;
  details?: string;
};

/** One deduped list of bullets relevant to this spend context (rate shown separately). */
export function buildContextualBenefitBullets(
  benefits: CardSpendBenefits,
  opts?: { rotatingQuarters?: RotatingQuarterBullet[] },
): ContextualBenefitBullet[] {
  const seen = new Set<string>();
  const out: ContextualBenefitBullet[] = [];

  const push = (group: ContextualBenefitBullet["group"], text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isDuplicateBenefitLine(trimmed, seen, benefits.rateLabel)) return;
    seen.add(normalizeBenefitKey(trimmed));
    out.push({ group, text: trimmed });
  };

  for (const n of benefits.merchantExclusionNotes) {
    push("exclusion", n);
  }
  for (const line of benefits.categoryEarnLines) {
    push("earn", line);
  }
  for (const c of benefits.statementCredits) {
    push("credit", formatStatementCreditLine(c));
  }
  for (const p of benefits.protections) {
    push("protection", formatProtectionLine(p));
  }
  for (const p of benefits.perks) {
    push("perk", `${p.title} — ${p.description}`);
  }
  for (const p of benefits.loyaltyPerks) {
    push("loyalty", p);
  }
  for (const c of benefits.relevantCaveats) {
    push("caveat", c);
  }
  for (const q of opts?.rotatingQuarters ?? []) {
    let text = `Rotating bonus (${q.label}): ${q.multiplier}%`;
    if (q.details?.trim()) text += ` — ${q.details.trim()}`;
    push("earn", text);
  }

  return out;
}

export function filterRotatingQuartersForCategory(
  quarters: unknown,
  category: SpendCategory,
  now: Date = new Date(),
): Array<{
  validFrom: string;
  validUntil: string;
  categories: string[];
  multiplier: number;
  label: string;
  details?: string;
}> {
  if (!Array.isArray(quarters)) return [];
  const out: Array<{
    validFrom: string;
    validUntil: string;
    categories: string[];
    multiplier: number;
    label: string;
    details?: string;
  }> = [];

  for (const row of quarters) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const validFrom = typeof o.validFrom === "string" ? o.validFrom : null;
    const validUntil = typeof o.validUntil === "string" ? o.validUntil : null;
    const label = typeof o.label === "string" ? o.label : null;
    const mult = typeof o.multiplier === "number" ? o.multiplier : null;
    const cats = Array.isArray(o.categories)
      ? o.categories.filter((c): c is string => typeof c === "string")
      : [];
    if (!validFrom || !validUntil || !label || mult == null || !cats.length) continue;
    if (!cats.includes(category)) continue;
    const from = new Date(validFrom);
    const until = new Date(validUntil);
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) continue;
    if (now < from || now > until) continue;
    out.push({
      validFrom,
      validUntil,
      categories: cats,
      multiplier: mult,
      label,
      details: typeof o.details === "string" ? o.details : undefined,
    });
  }
  return out;
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
        if (line) {
          const key = normalizeBenefitKey(line);
          if (
            key &&
            !categoryEarnLines.some((x) => normalizeBenefitKey(x) === key) &&
            !lineDuplicatesRateLabel(line, rateLabel)
          ) {
            categoryEarnLines.push(line);
          }
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
        const creditKey = normalizeBenefitKey(
          `${sc.description} ${sc.amountText ?? ""} ${sc.merchantHint ?? ""}`,
        );
        if (
          creditKey &&
          !statementCredits.some(
            (c) =>
              normalizeBenefitKey(`${c.description} ${c.amountText ?? ""}`) ===
              creditKey,
          )
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
        textMatchesMerchant(blob, args.merchantName)
      ) {
        perks.push({
          title: perk.title.trim(),
          description: perk.description.trim(),
        });
      }
    }

    if (
      extract.loyaltyProgramNotes?.trim() &&
      (textMatchesCategory(extract.loyaltyProgramNotes, args.category) ||
        textMatchesMerchant(extract.loyaltyProgramNotes, args.merchantName))
    ) {
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

  const seenEarn = new Set<string>();
  const pushEarnLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || isDuplicateBenefitLine(trimmed, seenEarn, rateLabel)) return;
    seenEarn.add(normalizeBenefitKey(trimmed));
    categoryEarnLines.push(trimmed);
  };

  for (const line of args.engineLines) {
    if (
      line.includes("promo") ||
      line.includes("cap") ||
      line.includes("Active") ||
      line.includes("Excludes:") ||
      line.includes("excluded") ||
      line.includes("Monthly cap:")
    ) {
      pushEarnLine(line);
    }
  }

  const benefitsSummary = null;
  const summarySnippet = null;

  return {
    rateLabel,
    categoryEarnLines,
    statementCredits,
    protections,
    perks,
    welcomeOffer: null,
    loyaltyPerks,
    relevantCaveats,
    merchantExclusionNotes,
    benefitsSummary,
    summarySnippet,
  };
}

export function formatStatementCreditLine(c: SpendBenefitCredit): string {
  return formatStatementCreditHint({
    description: c.description,
    amountText: c.amountText,
    cadence: c.cadence,
    merchantHint: c.merchantHint,
    enrollmentRequired: c.enrollmentRequired,
  });
}

export function formatProtectionLine(p: SpendBenefitProtection): string {
  const parts = [p.title, p.coverageSummary];
  if (p.limitsText) parts.push(`Limits: ${p.limitsText}`);
  return parts.join(" — ");
}
