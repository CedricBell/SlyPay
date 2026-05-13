import { z } from "zod";

/** LLMs often emit `null` for absent optional fields; Zod's `.optional()` does not accept null. */
function nullToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === null ? undefined : val), schema);
}

/** Structured rewards snapshot inferred from an issuer PDF — not a legal representation of terms. */
export const rewardsExtractSchema = z.object({
  summary: z.string(),
  earnRates: z.array(
    z.object({
      categoryHint: z.string(),
      multiplierDescription: z.string(),
      notes: nullToUndefined(z.string().optional()),
    }),
  ),
  statementCredits: z.array(
    z.object({
      description: z.string(),
      amountText: nullToUndefined(z.string().optional()),
      cadence: nullToUndefined(z.string().optional()),
    }),
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
  loyaltyProgramNotes: nullToUndefined(z.string().optional()),
  caveats: z.array(z.string()),
});

export type RewardsExtract = z.infer<typeof rewardsExtractSchema>;
