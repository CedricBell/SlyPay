import { EarningType, SpendCategory, type RewardRule } from "@prisma/client";
import { dec } from "@/lib/serialize";

/** Per-category weight for rule-based score (high-value everyday categories count more). */
const CATEGORY_SCORE_WEIGHT: Record<SpendCategory, number> = {
  GROCERIES: 1.28,
  DINING: 1.18,
  TRAVEL: 1.18,
  GAS: 1.04,
  ONLINE_SHOPPING: 1.06,
  DRUGSTORES: 1.05,
  ENTERTAINMENT: 1.03,
  WHOLESALE: 1.04,
  OTHER: 0.42,
};

export type WalletScoreBreakdown = {
  /** From PDF `statementCredits` (counts + parsed $ amounts). */
  statementCredits: number;
  /** From PDF `earnRates` text (parsed multipliers / %). */
  earnStructure: number;
  /** From persisted `RewardRule` rows on the card. */
  rewardRules: number;
  /** Non-positive: annual fee from PDF reduces the headline score. */
  annualFeePenalty: number;
};

function parseMoneyFromText(s: string): number {
  let total = 0;
  const re = /\$[\d,]+(?:\.\d{2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[0].slice(1).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

function parseAnnualFeeDollarsFromExtract(o: Record<string, unknown>): number {
  const af = o.annualFee;
  if (af && typeof af === "object") {
    const t = String((af as { amountText?: string }).amountText ?? "");
    const d = parseMoneyFromText(t);
    if (d > 0 && d < 8000) return d;
  }
  const caveats = Array.isArray(o.caveats)
    ? (o.caveats as unknown[]).map((c) => String(c)).join(" ")
    : "";
  const blob = `${String(o.summary ?? "")} ${caveats}`.toLowerCase();
  const patterns: RegExp[] = [
    /annual\s+(?:membership\s+)?fee[^$\d]{0,48}\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:\/\s*year|per\s+year|annual(?:ly)?|\/yr\b)/i,
    /(?:^|[\s,])\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:annual|\/yr|per\s+year)\s+fee/i,
  ];
  let best = 0;
  for (const re of patterns) {
    const m = blob.match(re);
    if (m?.[1]) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0 && n < 8000) best = Math.max(best, n);
    }
  }
  return best;
}

/** Best single multiplier-like signal from issuer wording (x, %, points per $). */
function bestMultiplierFromEarnText(text: string): number {
  const t = text.toLowerCase();
  let best = 0;
  const pct = t.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) best = Math.max(best, Number(pct[1]));
  const nx = t.match(/(\d+(?:\.\d+)?)\s*x\b/);
  if (nx) best = Math.max(best, Number(nx[1]));
  const ppm = t.match(
    /(\d+(?:\.\d+)?)\s*(?:pts?|points)\s*(?:per|\/)\s*\$?\s*1\b/i,
  );
  if (ppm) best = Math.max(best, Number(ppm[1]));
  return Number.isFinite(best) ? best : 0;
}

function categoryHintWeight(hint: string): number {
  const h = hint.toLowerCase();
  let w = 1;
  if (/(grocery|supermarket|food|groceries)/i.test(h)) w *= 1.12;
  if (/(dining|restaurant|eat)/i.test(h)) w *= 1.08;
  if (/(travel|airline|hotel|transit)/i.test(h)) w *= 1.08;
  if (/(gas|fuel)/i.test(h)) w *= 1.04;
  if (/(uber|lyft|rideshare)/i.test(h)) w *= 1.06;
  return w;
}

/**
 * Scores derived only from the catalog PDF JSON (statement credits + earn rates wording).
 */
export function scoreFromExtractJson(json: unknown): {
  statement: number;
  earn: number;
  /** Non-positive adjustment from annual fee (USD). */
  annualFeePenalty: number;
} {
  if (!json || typeof json !== "object") {
    return { statement: 0, earn: 0, annualFeePenalty: 0 };
  }
  const o = json as Record<string, unknown>;

  let statement = 0;
  const sc = o.statementCredits;
  if (Array.isArray(sc)) {
    for (const item of sc) {
      if (!item || typeof item !== "object") continue;
      const desc = String(
        (item as { description?: string }).description ?? "",
      );
      const amt = String((item as { amountText?: string }).amountText ?? "");
      statement += 6;
      const dollars = parseMoneyFromText(`${amt} ${desc}`);
      if (dollars > 0) {
        statement += Math.min(42, Math.sqrt(dollars) * 2.4);
      }
    }
    statement = Math.min(90, statement);
  }

  let earn = 0;
  const er = o.earnRates;
  if (Array.isArray(er)) {
    for (const row of er) {
      if (!row || typeof row !== "object") continue;
      const desc = String(
        (row as { multiplierDescription?: string }).multiplierDescription ?? "",
      );
      const hint = String((row as { categoryHint?: string }).categoryHint ?? "");
      const m = bestMultiplierFromEarnText(`${desc} ${hint}`);
      if (m > 0) {
        earn += m * 4.2 * categoryHintWeight(hint);
      } else {
        earn += 2.5;
      }
    }
    earn = Math.min(130, earn);
  }

  const annualDollars = parseAnnualFeeDollarsFromExtract(o);
  const annualFeePenalty =
    annualDollars > 0
      ? -Math.min(95, Math.round(Math.sqrt(annualDollars) * 2.75))
      : 0;

  return {
    statement: Math.round(statement),
    earn: Math.round(earn),
    annualFeePenalty,
  };
}

export type RewardRuleScoreInput = Pick<
  RewardRule,
  "category" | "multiplier" | "earningType"
>;

/**
 * Score from normalized rules on the card (e.g. 6× GROCERIES boosts more than 6× OTHER).
 */
export function scoreFromRewardRules(rules: RewardRuleScoreInput[]): number {
  if (!rules.length) return 0;
  let s = 0;
  for (const r of rules) {
    const m = dec(r.multiplier);
    const w = CATEGORY_SCORE_WEIGHT[r.category] ?? 1;
    const typeBoost =
      r.earningType === EarningType.CASHBACK_PERCENT ? 1.12 : 1;
    s += m * w * 3.2 * typeBoost;
  }
  return Math.min(200, Math.round(s));
}

export function computeWalletScore(
  rules: RewardRuleScoreInput[],
  catalogExtractJson: unknown,
): { total: number; breakdown: WalletScoreBreakdown } {
  const ext = scoreFromExtractJson(catalogExtractJson);
  const rulesPart = scoreFromRewardRules(rules);
  const breakdown: WalletScoreBreakdown = {
    statementCredits: ext.statement,
    earnStructure: ext.earn,
    rewardRules: rulesPart,
    annualFeePenalty: ext.annualFeePenalty,
  };
  const total = Math.max(
    0,
    Math.round(
      breakdown.statementCredits +
        breakdown.earnStructure +
        breakdown.rewardRules +
        breakdown.annualFeePenalty,
    ),
  );
  return { total, breakdown };
}
