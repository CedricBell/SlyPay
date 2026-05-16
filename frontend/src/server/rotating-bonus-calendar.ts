import { EarningType, OfferStackPolicy, SpendCategory } from "@prisma/client";
import type { EngineOffer } from "@/server/decision-engine.types";

/**
 * Curated issuer-style rotating categories (e.g. Discover / Chase Freedom 5%).
 * Synced to `CardCatalogProduct.rotatingBonusCalendar` and merged into the
 * decision engine as time-bounded offers (same semantics as `Offer`).
 */
export type RotatingBonusQuarterSpec = {
  validFrom: string;
  validUntil: string;
  categories: SpendCategory[];
  /** Cashback % (e.g. 5) when `earningType` is CASHBACK_PERCENT */
  multiplier: number;
  /** Human label, e.g. "Discover it Q1 2026 (Jan–Mar)" */
  label: string;
  stackPolicy?: OfferStackPolicy;
  /** Enrollment, $1,500/qtr caps, etc. — not enforced by the engine yet */
  details?: string;
  /**
   * When set, this rotating window uses this earning type for value math (e.g. 5% cashback
   * even if the base rule row is still generic POINTS from an older extract).
   */
  earningType?: EarningType;
};

const SPEND = new Set<string>(Object.values(SpendCategory));

function isSpendCategory(s: string): s is SpendCategory {
  return SPEND.has(s);
}

function parseQuarter(row: unknown): RotatingBonusQuarterSpec | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const validFrom = typeof o.validFrom === "string" ? o.validFrom : null;
  const validUntil = typeof o.validUntil === "string" ? o.validUntil : null;
  const label = typeof o.label === "string" ? o.label : null;
  const mult = typeof o.multiplier === "number" ? o.multiplier : null;
  const catsRaw = o.categories;
  if (!validFrom || !validUntil || !label || mult == null || !Array.isArray(catsRaw)) {
    return null;
  }
  const categories = catsRaw.filter(
    (c): c is SpendCategory => typeof c === "string" && isSpendCategory(c),
  );
  if (!categories.length) return null;
  const stackPolicy =
    o.stackPolicy === OfferStackPolicy.ADDITIVE
      ? OfferStackPolicy.ADDITIVE
      : OfferStackPolicy.REPLACE_BASE;
  const details = typeof o.details === "string" ? o.details : undefined;
  const etRaw = o.earningType;
  const earningType =
    etRaw === EarningType.CASHBACK_PERCENT ||
    etRaw === EarningType.POINTS ||
    etRaw === EarningType.MILES
      ? etRaw
      : etRaw === "CASHBACK_PERCENT"
        ? EarningType.CASHBACK_PERCENT
        : etRaw === "POINTS"
          ? EarningType.POINTS
          : etRaw === "MILES"
            ? EarningType.MILES
            : undefined;
  return {
    validFrom,
    validUntil,
    categories,
    multiplier: mult,
    label,
    stackPolicy,
    details,
    earningType,
  };
}

/** Validates JSON from DB or static catalog and turns it into engine offers (one per category per window). */
export function rotatingCalendarToEngineOffers(json: unknown): EngineOffer[] {
  if (!Array.isArray(json)) return [];
  const out: EngineOffer[] = [];
  for (const item of json) {
    const q = parseQuarter(item);
    if (!q) continue;
    const from = new Date(q.validFrom);
    const until = new Date(q.validUntil);
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) continue;
    if (until < from) continue;
    const title =
      q.details && q.details.length > 0
        ? `${q.label} — ${q.details}`
        : q.label;
    for (const category of q.categories) {
      out.push({
        category,
        multiplier: q.multiplier,
        stackPolicy: q.stackPolicy ?? OfferStackPolicy.REPLACE_BASE,
        validFrom: from,
        validUntil: until,
        title,
        earningTypeOverride: q.earningType,
      });
    }
  }
  return out;
}

export function mergeEngineOffers(
  manual: EngineOffer[],
  fromCatalog: EngineOffer[],
): EngineOffer[] {
  return [...manual, ...fromCatalog];
}
