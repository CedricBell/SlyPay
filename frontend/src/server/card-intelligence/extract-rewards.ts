import { cardIntelCompleteJson } from "@/server/card-intelligence/card-intel-llm";
import {
  rewardsExtractSchema,
  type RewardsExtract,
} from "@/server/card-intelligence/rewards-extract-schema";

const SYSTEM = `You extract credit-card rewards information from the document text provided by the user.
The primary source is usually an official issuer PDF or HTML terms/benefits page (plain text extracted from HTML).
The same payload may end with a clearly delimited block from third-party editorial sites (e.g. NerdWallet, The Points Guy) for extra context — treat that block as non-authoritative: use it only to fill gaps or clarify widely reported benefits; if it conflicts with the official portion above, follow the official text and mention the disagreement in caveats.
Rules:
- Base every field on the supplied documentText. If something is not stated in either portion, say so in caveats and use empty arrays where appropriate.
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
