import { cardIntelCompleteJson } from "@/server/card-intelligence/card-intel-llm";
import {
  rewardsExtractSchema,
  type RewardsExtract,
} from "@/server/card-intelligence/rewards-extract-schema";

const SYSTEM = `You extract credit-card rewards and benefits from the document text provided by the user.
The primary source is usually an official issuer PDF or HTML terms/benefits page (plain text extracted from HTML).
The same payload may end with a clearly delimited block from third-party editorial sites — treat that block as non-authoritative.

Rules:
- Base every field on the supplied documentText. If something is not stated, say so in caveats and use empty arrays.
- Do not invent issuer URLs, enrollment steps, or dollar amounts unsupported by the text.
- summary: 2–5 factual sentences on earn + headline perks.
- benefitsSummary: 2–4 sentences on purchase/travel protections, insurance, lounge/status, and non-earn perks (e.g. phone protection, rental car coverage).
- earnRates: each earning structure with categoryHint mirroring document wording. Put merchant exclusions (Target, Walmart, Costco, etc.) in excludedMerchants[] for that rate — NOT only in caveats.
- statementCredits: ALL recurring credits (hotel/resort/airline/travel/dining/retail/Uber/Digital Entertainment, etc.) with amountText, cadence, merchantHint when named (e.g. Hilton, Saks, airline fee credit).
- protections: purchase/travel/phone/extended warranty/return/fraud/rental car coverage with coverageSummary and limitsText when stated.
- perks: lounge access, status, Global Entry/TSA PreCheck, concierge, etc.
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
  return rewardsExtractSchema.parse(parsed);
}
