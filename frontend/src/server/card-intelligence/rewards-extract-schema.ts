import { SpendCategory } from "@prisma/client";
import { z } from "zod";
import { resolveStatementCreditTitle } from "@/lib/statement-credit-display";

const PROTECTION_KINDS = [
  "PURCHASE",
  "TRAVEL",
  "PHONE",
  "RENTAL_CAR",
  "EXTENDED_WARRANTY",
  "RETURN",
  "FRAUD",
  "BAGGAGE",
  "TRIP_DELAY",
  "OTHER",
] as const;

export const protectionKindSchema = z.enum(PROTECTION_KINDS);
export type ProtectionKind = z.infer<typeof protectionKindSchema>;

/** Coerce LLM output (number, object, array) into a display string. */
export function coerceToString(val: unknown, fallback = ""): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    const t = val.trim();
    return t || fallback;
  }
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    const joined = val
      .map((x) => coerceToString(x, ""))
      .filter(Boolean)
      .join(", ");
    return joined || fallback;
  }
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    for (const key of [
      "multiplierDescription",
      "description",
      "text",
      "label",
      "summary",
      "title",
      "rate",
      "multiplier",
      "value",
      "coverageSummary",
    ]) {
      if (key in o) {
        const s = coerceToString(o[key], "");
        if (s) return s;
      }
    }
  }
  return fallback;
}

function coerceProtectionKind(val: unknown): ProtectionKind {
  const raw = coerceToString(val, "").toUpperCase().replace(/[\s-]+/g, "_");
  if ((PROTECTION_KINDS as readonly string[]).includes(raw)) {
    return raw as ProtectionKind;
  }
  const blob = coerceToString(val, "").toLowerCase();
  if (/\btravel\b|trip|flight|baggage/.test(blob)) return "TRAVEL";
  if (/\bphone\b|mobile|wireless/.test(blob)) return "PHONE";
  if (/\brental\b|car rental/.test(blob)) return "RENTAL_CAR";
  if (/\bwarranty\b/.test(blob)) return "EXTENDED_WARRANTY";
  if (/\breturn\b/.test(blob)) return "RETURN";
  if (/\bfraud\b/.test(blob)) return "FRAUD";
  if (/\bpurchase\b|buy/.test(blob)) return "PURCHASE";
  return "OTHER";
}

function normalizeObjectOrString(
  val: unknown,
  fallbackDescription: string,
): { description: string; amountText?: string; spendRequirement?: string; timeframe?: string } | undefined {
  if (val == null) return undefined;
  if (typeof val === "string" || typeof val === "number") {
    const description = coerceToString(val, fallbackDescription);
    return description ? { description } : undefined;
  }
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    const description = coerceToString(
      o.description ?? o.summary ?? o.text ?? o.label,
      fallbackDescription,
    );
    return {
      description,
      amountText: coerceToString(o.amountText ?? o.amount, "") || undefined,
      spendRequirement: coerceToString(o.spendRequirement ?? o.spend, "") || undefined,
      timeframe: coerceToString(o.timeframe ?? o.period, "") || undefined,
    };
  }
  return undefined;
}

function normalizeAnnualFee(
  val: unknown,
): { amountText?: string; description?: string } | undefined {
  if (val == null) return undefined;
  if (typeof val === "string" || typeof val === "number") {
    const text = coerceToString(val, "");
    return text ? { description: text, amountText: text } : undefined;
  }
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    return {
      amountText: coerceToString(o.amountText ?? o.amount, "") || undefined,
      description: coerceToString(o.description ?? o.text, "") || undefined,
    };
  }
  return undefined;
}

function normalizeEarnRateRow(raw: unknown): {
  categoryHint: string;
  multiplierDescription: string;
  notes?: string;
  excludedMerchants: string[];
  capText?: string;
} | null {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string") {
      return {
        categoryHint: "General purchases",
        multiplierDescription: raw,
        excludedMerchants: [],
      };
    }
    return null;
  }
  const o = raw as Record<string, unknown>;
  return {
    categoryHint: coerceToString(o.categoryHint ?? o.category, "General purchases"),
    multiplierDescription: coerceToString(
      o.multiplierDescription ?? o.multiplier ?? o.rate ?? o.description,
      "Per issuer terms",
    ),
    notes: coerceToString(o.notes, "") || undefined,
    excludedMerchants: Array.isArray(o.excludedMerchants)
      ? o.excludedMerchants.map((m) => coerceToString(m, "")).filter(Boolean)
      : [],
    capText: coerceToString(o.capText ?? o.cap, "") || undefined,
  };
}

function normalizeStatementCredit(raw: unknown): {
  description: string;
  amountText?: string;
  cadence?: string;
  annualCapText?: string;
  merchantHint?: string;
  categoryHint?: string;
  enrollmentRequired?: boolean;
  notes?: string;
} | null {
  if (!raw) return null;
  if (typeof raw === "string" || typeof raw === "number") {
    return { description: coerceToString(raw, "Statement credit") };
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const amountText = coerceToString(o.amountText ?? o.amount, "") || undefined;
  const cadence = coerceToString(o.cadence ?? o.frequency, "") || undefined;
  const annualCapText =
    coerceToString(o.annualCapText ?? o.annualCap ?? o.yearlyCap, "") ||
    undefined;
  const notes = coerceToString(o.notes, "") || undefined;
  const merchantHint =
    coerceToString(o.merchantHint ?? o.merchant ?? o.partner, "") || undefined;
  const categoryHint =
    coerceToString(o.categoryHint ?? o.category, "") || undefined;
  const rawDescription = coerceToString(
    o.title ?? o.benefitName ?? o.description ?? o.name ?? o.credit,
    "",
  );
  const description = resolveStatementCreditTitle({
    description: rawDescription,
    amountText,
    cadence,
    merchantHint,
    categoryHint,
  });
  return {
    description,
    amountText,
    cadence,
    annualCapText,
    merchantHint,
    categoryHint,
    enrollmentRequired:
      typeof o.enrollmentRequired === "boolean" ? o.enrollmentRequired : undefined,
    notes,
  };
}

function normalizeProtection(raw: unknown): {
  kind: ProtectionKind;
  title: string;
  coverageSummary: string;
  limitsText?: string;
  notes?: string;
} | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return {
      kind: coerceProtectionKind(raw),
      title: raw,
      coverageSummary: "See issuer terms",
    };
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    kind: coerceProtectionKind(o.kind ?? o.type ?? o.category),
    title: coerceToString(o.title ?? o.name, "Protection"),
    coverageSummary: coerceToString(
      o.coverageSummary ?? o.summary ?? o.description,
      "See issuer terms",
    ),
    limitsText: coerceToString(o.limitsText ?? o.limits, "") || undefined,
    notes: coerceToString(o.notes, "") || undefined,
  };
}

function normalizePerk(raw: unknown): {
  title: string;
  description: string;
  categoryHint?: string;
} | null {
  if (!raw) return null;
  if (typeof raw === "string" || typeof raw === "number") {
    const t = coerceToString(raw, "Perk");
    return { title: t, description: t };
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = coerceToString(o.title ?? o.name, "Perk");
  return {
    title,
    description: coerceToString(o.description ?? o.summary ?? o.text, title),
    categoryHint: coerceToString(o.categoryHint ?? o.category, "") || undefined,
  };
}

function normalizeCaveats(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === "string") {
    const t = val.trim();
    if (!t) return [];
    return t.includes("\n")
      ? t.split(/\n+/).map((s) => s.trim()).filter(Boolean)
      : [t];
  }
  if (Array.isArray(val)) {
    return val.map((c) => coerceToString(c, "")).filter(Boolean);
  }
  return [];
}

/** Normalizes LLM JSON drift before Zod 4 validation (no reliance on field preprocess). */
export function normalizeRewardsExtractPayload(raw: unknown): RewardsExtract {
  const empty: RewardsExtract = {
    summary: "Summary not stated in document.",
    earnRates: [],
    statementCredits: [],
    protections: [],
    perks: [],
    caveats: [],
    globalExcludedMerchants: [],
  };

  if (!raw || typeof raw !== "object") return empty;

  const o = raw as Record<string, unknown>;

  const earnRates = Array.isArray(o.earnRates)
    ? o.earnRates.map(normalizeEarnRateRow).filter((r): r is NonNullable<typeof r> => r != null)
    : [];

  const statementCredits = Array.isArray(o.statementCredits)
    ? o.statementCredits
        .map(normalizeStatementCredit)
        .filter((r): r is NonNullable<typeof r> => r != null)
    : [];

  const protections = Array.isArray(o.protections)
    ? o.protections
        .map(normalizeProtection)
        .filter((r): r is NonNullable<typeof r> => r != null)
    : [];

  const perks = Array.isArray(o.perks)
    ? o.perks.map(normalizePerk).filter((r): r is NonNullable<typeof r> => r != null)
    : [];

  const welcomeOffer = normalizeObjectOrString(o.welcomeOffer, "Welcome offer");
  const annualFee = normalizeAnnualFee(o.annualFee);

  const benefitsSummary = coerceToString(o.benefitsSummary, "") || undefined;

  return {
    summary: coerceToString(o.summary, "Summary not stated in document."),
    benefitsSummary,
    earnRates,
    statementCredits,
    protections,
    perks,
    welcomeOffer,
    annualFee,
    foreignTransactionFee: coerceToString(o.foreignTransactionFee, "") || undefined,
    loyaltyProgramNotes: coerceToString(o.loyaltyProgramNotes, "") || undefined,
    caveats: normalizeCaveats(o.caveats),
    globalExcludedMerchants: Array.isArray(o.globalExcludedMerchants)
      ? o.globalExcludedMerchants.map((m) => coerceToString(m, "")).filter(Boolean)
      : [],
  };
}

const earnRateSchema = z.object({
  categoryHint: z.string().min(1),
  multiplierDescription: z.string().min(1),
  notes: z.string().optional(),
  excludedMerchants: z.array(z.string()).default([]),
  capText: z.string().optional(),
});

/** Structured rewards snapshot inferred from an issuer PDF — not a legal representation of terms. */
export const rewardsExtractSchema = z.object({
  summary: z.string().min(1),
  benefitsSummary: z.string().optional(),
  earnRates: z.array(earnRateSchema),
  statementCredits: z.array(
    z.object({
      description: z
        .string()
        .min(3)
        .refine(
          (s) => !/^(statement\s*credit|credit)$/i.test(s.trim()),
          "Use a specific benefit name (e.g. Uber Cash, airline fee credit)",
        ),
      amountText: z.string().optional(),
      cadence: z.string().optional(),
      annualCapText: z.string().optional(),
      merchantHint: z.string().optional(),
      categoryHint: z.string().optional(),
      enrollmentRequired: z.boolean().optional(),
      notes: z.string().optional(),
    }),
  ),
  protections: z.array(
    z.object({
      kind: protectionKindSchema,
      title: z.string().min(1),
      coverageSummary: z.string().min(1),
      limitsText: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
  perks: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      categoryHint: z.string().optional(),
    }),
  ),
  welcomeOffer: z
    .object({
      description: z.string().min(1),
      amountText: z.string().optional(),
      spendRequirement: z.string().optional(),
      timeframe: z.string().optional(),
    })
    .optional(),
  annualFee: z
    .object({
      amountText: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  foreignTransactionFee: z.string().optional(),
  loyaltyProgramNotes: z.string().optional(),
  caveats: z.array(z.string()),
  globalExcludedMerchants: z.array(z.string()).default([]),
});

export type RewardsExtract = z.infer<typeof rewardsExtractSchema>;

export function parseRewardsExtract(raw: unknown): RewardsExtract {
  const normalized = normalizeRewardsExtractPayload(raw);
  return rewardsExtractSchema.parse(normalized);
}

export function spendCategoryFromHint(hint: string | null | undefined): SpendCategory | null {
  if (!hint?.trim()) return null;
  const blob = hint.toLowerCase();
  if (/\b(grocery|groceries|supermarket)\b/.test(blob)) return SpendCategory.GROCERIES;
  if (/\b(dining|restaurant|food delivery|doordash|grubhub|uber eats)\b/.test(blob)) {
    return SpendCategory.DINING;
  }
  if (/\b(travel|hotel|airline|flight|resort|lodging)\b/.test(blob)) return SpendCategory.TRAVEL;
  if (/\b(gas|fuel|service station)\b/.test(blob)) return SpendCategory.GAS;
  if (/\b(online|e-?commerce|internet)\b/.test(blob)) return SpendCategory.ONLINE_SHOPPING;
  if (/\b(drugstore|pharmacy)\b/.test(blob)) return SpendCategory.DRUGSTORES;
  if (/\b(entertainment|streaming|movie)\b/.test(blob)) return SpendCategory.ENTERTAINMENT;
  if (/\b(wholesale|warehouse|costco|sam'?s)\b/.test(blob)) return SpendCategory.WHOLESALE;
  return null;
}
