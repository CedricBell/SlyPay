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
- For quarterly rotating 5% programs (Discover it, Chase Freedom Flex, etc.): do NOT list each quarter's categories as permanent earnRates. Instead add ONE earnRates row for the unlimited base rate (typically 1% on all purchases) and put quarterly 5% details in notes/capText (e.g. "5% on up to $1,500 combined per quarter in activated categories — see issuer calendar"). Set capText when the document states quarterly or annual caps on bonus categories.
- statementCredits: EVERY recurring credit with a SPECIFIC description from the document — NEVER use only "Statement credit". Include amountText, cadence, merchantHint, categoryHint, annualCapText, notes when stated.
- For statementCredits: amountText is the credit for ONE period (e.g. "$100" each quarter), NOT the annual total unless cadence is annual. If the document gives both (e.g. up to $100/quarter, $400/calendar year), set amountText to the per-period amount, cadence to quarterly/monthly/annual, and annualCapText to the yearly cap verbatim.
- Do not tag annual totals as quarterly or monthly (wrong: amountText "$400" + cadence "quarterly" for a $100/quarter program; wrong: "$155" + "monthly" for Walmart+ annual membership credit).
- protections: ONLY insurance and purchase/travel coverage programs — trip delay, baggage, rental car **damage waiver insurance**, purchase protection, extended warranty, cell phone **protection**, travel accident, etc. One row per coverage. coverageSummary must quote or closely paraphrase what the document states. Do NOT put lounge access, hotel credits, elite status, or partner programs here.
- perks: EVERY non-insurance benefit program — one row per program (not one row per section header). Include lounge access, elite status, TSA PreCheck/Global Entry credits, concierge, car-rental **privileges** (non-insurance), cruise privileges, and **each distinct benefit** listed under headings like "More Travel Benefits", "More Hotel Benefits", "Travel benefits", "Hotel benefits", "Additional benefits", Fine Hotels + Resorts, The Hotel Collection, etc. Use categoryHint "travel", "hotel", "dining", "entertainment", or "other". description must state amounts, partners, and enrollment requirements when the document mentions them.
- If a section groups many benefits (e.g. "More Hotel Benefits"), emit one perks[] row per listed program inside that section — never skip the section because protections[] already has travel insurance.
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
