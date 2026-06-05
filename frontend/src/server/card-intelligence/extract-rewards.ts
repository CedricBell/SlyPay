import { cardIntelCompleteJson } from "@/server/card-intelligence/card-intel-llm";
import {
  parseRewardsExtract,
  type RewardsExtract,
} from "@/server/card-intelligence/rewards-extract-schema";

const SYSTEM = `You extract credit-card rewards and benefits from the document text provided by the user.
The primary source is usually an official issuer PDF or HTML terms/benefits page (plain text extracted from HTML).
The same payload may end with a clearly delimited block from third-party editorial sites — treat that block as non-authoritative.

Rules:
- Base every field on the supplied documentText only. If something is not stated, use empty arrays and note in caveats — never guess.
- Do not invent amounts, partners, or benefits (e.g. do not write "Resy $400 quarterly" or "Walmart $155 monthly" unless that exact program appears verbatim in documentText).
- summary: leave empty string "" (we do not want paraphrased marketing summaries).
- benefitsSummary: leave empty string "" OR paste one short verbatim quote (max 240 chars) from the document with quotation marks — no paraphrase.
- earnRates: each earning structure; categoryHint must quote document wording. Put merchant exclusions in excludedMerchants[] for that rate.
- statementCredits: EVERY recurring credit with a SPECIFIC description from the document — NEVER use only "Statement credit". Include amountText, cadence, merchantHint, categoryHint when stated.
- protections: extract ALL purchase/travel/phone/extended warranty/return protection/fraud/rental car/trip delay/baggage/accident coverages mentioned — one row per program. coverageSummary must quote or closely paraphrase only what the document states.
- perks: lounge, status, Global Entry, etc. — only if stated.
- welcomeOffer: signup bonus if stated.
- annualFee / foreignTransactionFee when explicitly stated.
- globalExcludedMerchants: merchants excluded from multiple categories if stated globally.
- caveats: ambiguities, caps, enrollment requirements, or missing detail.

Respond with JSON matching the schema (earnRates[].excludedMerchants, statementCredits[].merchantHint, protections[], perks[], welcomeOffer, benefitsSummary, globalExcludedMerchants).`;

export async function extractRewardsFromDocumentText(args: {
  cardName: string;
  issuer: string;
  documentText: string;
}): Promise<RewardsExtract> {
  const maxChars = Number(process.env.CARD_INTEL_MAX_DOC_CHARS ?? "120000");
  const clipped = args.documentText.slice(
    0,
    Number.isFinite(maxChars) ? Math.max(4_000, maxChars) : 120_000,
  );

  const raw = await cardIntelCompleteJson({
    system: SYSTEM,
    user: JSON.stringify({
      cardName: args.cardName,
      issuer: args.issuer,
      documentText: clipped,
    }),
  });

  const parsed: unknown = JSON.parse(raw);
  return parseRewardsExtract(parsed);
}
