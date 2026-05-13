import { cardIntelCompleteJson } from "@/server/card-intelligence/card-intel-llm";
import {
  rewardsExtractSchema,
  type RewardsExtract,
} from "@/server/card-intelligence/rewards-extract-schema";

const SYSTEM = `You extract credit-card rewards information from the official document text provided by the user.
Rules:
- Base every field ONLY on the supplied documentText. If something is not stated, say so in caveats and use empty arrays where appropriate.
- Do not invent issuer URLs, enrollment steps, or dollar amounts that are not supported by the text.
- summary must be 2–5 factual sentences in plain language.
- earnRates: list earning structures described (points/cashback/miles per dollar or per spend), with categoryHint mirroring document wording.
- statementCredits: recurring statement credits / merchant credits / fee credits mentioned.
- annualFee: if the document states an annual membership/fee (e.g. "$95 per year"), set { "amountText": "$95", "description": "Annual fee" }; omit if not stated.
- loyaltyProgramNotes: named programs (e.g. Membership Rewards) if described.
- caveats: ambiguities, exclusions, caps, or missing detail from the document.

Respond with a single JSON object matching this shape:
{
  "summary": string,
  "earnRates": [{ "categoryHint": string, "multiplierDescription": string, "notes"?: string }],
  "statementCredits": [{ "description": string, "amountText"?: string, "cadence"?: string }],
  "annualFee"?: { "amountText"?: string, "description"?: string },
  "loyaltyProgramNotes"?: string,
  "caveats": string[]
}`;

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
