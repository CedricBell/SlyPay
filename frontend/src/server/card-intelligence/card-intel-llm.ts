import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

type CardIntelProvider = "openai" | "anthropic";

function parseProviderChain(): CardIntelProvider[] {
  const raw = process.env.CARD_INTEL_PROVIDER?.trim();
  if (raw) {
    const parts = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((p): p is CardIntelProvider => p === "openai" || p === "anthropic");
    if (parts.length) return parts;
  }
  const hasOpenai = !!process.env.OPENAI_API_KEY?.trim();
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  if (hasOpenai && hasAnthropic) return ["openai", "anthropic"];
  if (hasAnthropic && !hasOpenai) return ["anthropic"];
  return ["openai"];
}

function shouldTryNextProvider(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "status" in err) {
    const s = (err as { status?: number }).status;
    if (s === 429) return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|quota|insufficient_quota|rate_limit|rate limit/i.test(msg);
}

async function completeOpenAI(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = process.env.CARD_INTEL_MODEL?.trim() || "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty OpenAI response");
  return stripJsonFences(raw);
}

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return t.trim();
}

async function completeAnthropic(system: string, user: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const model =
    process.env.CARD_INTEL_ANTHROPIC_MODEL?.trim() ||
    "claude-3-5-haiku-20241022";
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Empty Anthropic response");
  return stripJsonFences(block.text);
}

/**
 * JSON-only completion for card intel. Tries providers in `CARD_INTEL_PROVIDER`
 * order (comma-separated), or auto `openai,anthropic` when both API keys are set
 * so a 429 on OpenAI falls through to Anthropic.
 */
export async function cardIntelCompleteJson(args: {
  system: string;
  user: string;
}): Promise<string> {
  const chain = parseProviderChain();
  let lastError: unknown;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const hasNext = i < chain.length - 1;

    if (provider === "openai" && !process.env.OPENAI_API_KEY?.trim()) continue;
    if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY?.trim())
      continue;

    try {
      if (provider === "openai") {
        return await completeOpenAI(args.system, args.user);
      }
      return await completeAnthropic(args.system, args.user);
    } catch (e) {
      lastError = e;
      if (hasNext && shouldTryNextProvider(e)) continue;
      throw e;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? lastError.message
      : "Card intel LLM: set OPENAI_API_KEY and/or ANTHROPIC_API_KEY (optional CARD_INTEL_PROVIDER=openai,anthropic).",
  );
}

