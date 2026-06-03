import { SpendCategory } from "@prisma/client";
import { z } from "zod";

/** LLMs often emit `null` for absent optional fields; Zod's `.optional()` does not accept null. */
function nullToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === null ? undefined : val), schema);
}

export const protectionKindSchema = z.enum([
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
]);

/** Structured rewards snapshot inferred from an issuer PDF — not a legal representation of terms. */
export const rewardsExtractSchema = z.object({
  summary: z.string(),
  /** Richer card positioning (insurance, lounge, status) beyond earn rates. */
  benefitsSummary: nullToUndefined(z.string().optional()),
  earnRates: z.array(
    z.object({
      categoryHint: z.string(),
      multiplierDescription: z.string(),
      notes: nullToUndefined(z.string().optional()),
      /** Merchants/brands excluded from this earn category (e.g. Target, Walmart). */
      excludedMerchants: z.array(z.string()).optional().default([]),
      capText: nullToUndefined(z.string().optional()),
    }),
  ),
  statementCredits: z.array(
    z.object({
      description: z.string(),
      amountText: nullToUndefined(z.string().optional()),
      cadence: nullToUndefined(z.string().optional()),
      merchantHint: nullToUndefined(z.string().optional()),
      categoryHint: nullToUndefined(z.string().optional()),
      enrollmentRequired: nullToUndefined(z.boolean().optional()),
    }),
  ),
  protections: z
    .array(
      z.object({
        kind: protectionKindSchema,
        title: z.string(),
        coverageSummary: z.string(),
        limitsText: nullToUndefined(z.string().optional()),
        notes: nullToUndefined(z.string().optional()),
      }),
    )
    .optional()
    .default([]),
  perks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        categoryHint: nullToUndefined(z.string().optional()),
      }),
    )
    .optional()
    .default([]),
  welcomeOffer: nullToUndefined(
    z
      .object({
        description: z.string(),
        amountText: nullToUndefined(z.string().optional()),
        spendRequirement: nullToUndefined(z.string().optional()),
        timeframe: nullToUndefined(z.string().optional()),
      })
      .optional(),
  ),
  /** Annual / membership fee when explicitly stated (used for wallet score). */
  annualFee: nullToUndefined(
    z
      .object({
        amountText: nullToUndefined(z.string().optional()),
        description: nullToUndefined(z.string().optional()),
      })
      .optional(),
  ),
  foreignTransactionFee: nullToUndefined(z.string().optional()),
  loyaltyProgramNotes: nullToUndefined(z.string().optional()),
  caveats: z.array(z.string()),
  /** Global merchant exclusions not tied to a single earn rate. */
  globalExcludedMerchants: z.array(z.string()).optional().default([]),
});

export type RewardsExtract = z.infer<typeof rewardsExtractSchema>;
export type ProtectionKind = z.infer<typeof protectionKindSchema>;

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
