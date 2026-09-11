import { EarningType, SpendCategory } from "@prisma/client";
import type { RewardRule } from "@prisma/client";
import type { RotatingBonusQuarterSpec } from "@/server/rotating-bonus-calendar";

const SPEND = new Set<string>(Object.values(SpendCategory));

export type RotatingQuarterPreview = {
  label: string;
  multiplier: number;
  categories: SpendCategory[];
  validFrom: string;
  validUntil: string;
  details?: string;
  isActive: boolean;
};

function parseQuarterRow(row: unknown): RotatingBonusQuarterSpec | null {
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
    (c): c is SpendCategory => typeof c === "string" && SPEND.has(c),
  );
  if (!categories.length) return null;
  return {
    validFrom,
    validUntil,
    categories,
    multiplier: mult,
    label,
    details: typeof o.details === "string" ? o.details : undefined,
    earningType:
      o.earningType === EarningType.CASHBACK_PERCENT
        ? EarningType.CASHBACK_PERCENT
        : undefined,
  };
}

export function parseRotatingCalendar(json: unknown): RotatingBonusQuarterSpec[] {
  if (!Array.isArray(json)) return [];
  const out: RotatingBonusQuarterSpec[] = [];
  for (const row of json) {
    const q = parseQuarterRow(row);
    if (q) out.push(q);
  }
  return out.sort(
    (a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime(),
  );
}

export function rotatingCategorySet(
  calendar: RotatingBonusQuarterSpec[],
): Set<SpendCategory> {
  const set = new Set<SpendCategory>();
  for (const q of calendar) {
    for (const c of q.categories) set.add(c);
  }
  return set;
}

function maxRotatingMultiplier(calendar: RotatingBonusQuarterSpec[]): number {
  return calendar.reduce((max, q) => Math.max(max, q.multiplier), 0);
}

/**
 * PDF extracts often list quarterly 5% categories as permanent rules. When a curated
 * rotating calendar exists, drop those mistaken static rows so the engine uses base
 * rate + time-bounded offers instead.
 */
export function sanitizeRewardRulesForRotatingCalendar(
  rules: RewardRule[],
  calendarJson: unknown,
): RewardRule[] {
  const calendar = parseRotatingCalendar(calendarJson);
  if (!calendar.length) return rules;

  const rotatingCats = rotatingCategorySet(calendar);
  const maxMult = maxRotatingMultiplier(calendar);

  const filtered = rules.filter((r) => {
    if (!rotatingCats.has(r.category)) return true;
    const mult = Number(r.multiplier);
    if (
      r.earningType === EarningType.CASHBACK_PERCENT &&
      mult >= maxMult
    ) {
      return false;
    }
    return true;
  });

  const hasOther = filtered.some((r) => r.category === SpendCategory.OTHER);
  if (hasOther) return filtered;

  const lowest =
    filtered.length > 0
      ? filtered.reduce((min, r) =>
          Number(r.multiplier) < Number(min.multiplier) ? r : min,
        )
      : null;

  const baseMult = lowest ? Number(lowest.multiplier) : 1;
  const baseType = lowest?.earningType ?? EarningType.CASHBACK_PERCENT;
  const template = filtered[0];

  return [
    ...filtered,
    {
      ...(template ?? {}),
      id: "__synthetic_other__",
      category: SpendCategory.OTHER,
      multiplier: baseMult as unknown as RewardRule["multiplier"],
      earningType: baseType,
      priority: 999,
      notes: "Default earn when no category rule matches.",
      capAmountMonthly: null,
      excludedMerchants: [],
      catalogProductSlug: template?.catalogProductSlug ?? "",
      createdAt: template?.createdAt ?? new Date(),
    } as RewardRule,
  ];
}

export function getActiveRotatingQuarter(
  calendarJson: unknown,
  now: Date = new Date(),
): RotatingBonusQuarterSpec | null {
  for (const q of parseRotatingCalendar(calendarJson)) {
    const from = new Date(q.validFrom);
    const until = new Date(q.validUntil);
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) continue;
    if (now >= from && now <= until) return q;
  }
  return null;
}

export function buildRotatingQuarterPreviews(
  calendarJson: unknown,
  now: Date = new Date(),
): RotatingQuarterPreview[] {
  return parseRotatingCalendar(calendarJson).map((q) => {
    const from = new Date(q.validFrom);
    const until = new Date(q.validUntil);
    const isActive = now >= from && now <= until;
    return {
      label: q.label,
      multiplier: q.multiplier,
      categories: q.categories,
      validFrom: q.validFrom,
      validUntil: q.validUntil,
      details: q.details,
      isActive,
    };
  });
}

export function formatRotatingCategoryList(categories: SpendCategory[]): string {
  return categories
    .map((c) => c.replaceAll("_", " ").toLowerCase())
    .join(", ");
}

/** Wallet / card detail highlights: base rate + current quarter, not mistaken static 5% rows. */
export function walletEarnHighlights(
  rules: RewardRule[],
  calendarJson: unknown,
  now: Date = new Date(),
): string[] {
  const calendar = parseRotatingCalendar(calendarJson);
  const lines: string[] = [];
  const rotatingCats = rotatingCategorySet(calendar);
  const active = getActiveRotatingQuarter(calendarJson, now);

  const other = rules.find((r) => r.category === SpendCategory.OTHER);
  if (other) {
    lines.push(
      `${Number(other.multiplier)}× base (${other.earningType.replace(/_/g, " ").toLowerCase()})`,
    );
  }

  if (active) {
    lines.push(
      `${active.multiplier}× ${formatRotatingCategoryList(active.categories)} — ${active.label}`,
    );
  } else if (calendar.length > 0) {
    lines.push("5% rotating categories — activate each quarter");
  }

  for (const r of rules) {
    if (r.category === SpendCategory.OTHER) continue;
    if (active?.categories.includes(r.category)) continue;
    if (rotatingCats.has(r.category)) continue;
    lines.push(
      `${Number(r.multiplier)}× ${r.category} (${r.earningType.replace(/_/g, " ").toLowerCase()})`,
    );
  }

  return lines.slice(0, 5);
}

export function rotatingRelevanceNote(
  calendarJson: unknown,
  category: SpendCategory,
  now: Date = new Date(),
): string | null {
  const calendar = parseRotatingCalendar(calendarJson);
  if (!calendar.length) return null;

  const active = getActiveRotatingQuarter(calendarJson, now);
  if (!active) {
    return "This card has quarterly rotating 5% categories — none are active for the current date.";
  }

  if (active.categories.includes(category)) {
    const cap =
      active.details?.includes("$1,500") || active.details?.includes("1,500")
        ? " Up to $1,500 combined spend this quarter, then 1%."
        : "";
    return `Active rotating bonus (${active.label}): ${active.multiplier}% on ${formatRotatingCategoryList(active.categories)} — activation required, not retroactive.${cap}`;
  }

  const catLabel = category.replaceAll("_", " ").toLowerCase();
  const activeLabel = formatRotatingCategoryList(active.categories);
  return `${catLabel} is not in this quarter's 5% categories (${activeLabel}, ${active.label}). Base rate applies unless another rule covers this spend.`;
}
