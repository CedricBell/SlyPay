import { assertEditorialSupplementUrl } from "@/server/card-intelligence/editorial-intel-allowlist";
import { fetchHtmlDocument } from "@/server/card-intelligence/fetch-document";
import { htmlDocumentToPlainText } from "@/server/card-intelligence/html-to-intel-text";

const MAX_URLS = 6;
const MAX_CHARS_PER_URL = 14_000;
const MAX_TOTAL_CHARS = 36_000;

function parseUrlList(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  const out: string[] = [];
  for (const x of json) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t) continue;
    out.push(t);
    if (out.length >= MAX_URLS) break;
  }
  return out;
}

/**
 * Fetches allowlisted editorial article HTML and returns plain text blocks for LLM context.
 * Failures on a single URL are skipped (best-effort); throws only if nothing could be fetched when URLs were given.
 */
export async function buildEditorialSupplementPlainText(
  json: unknown,
): Promise<string> {
  const urls = parseUrlList(json);
  if (!urls.length) return "";

  const blocks: string[] = [];
  let total = 0;

  for (const raw of urls) {
    try {
      assertEditorialSupplementUrl(raw);
      const html = await fetchHtmlDocument(raw);
      let chunk = htmlDocumentToPlainText(html).replace(/\s+/g, " ").trim();
      if (!chunk) continue;
      if (chunk.length > MAX_CHARS_PER_URL) {
        chunk = chunk.slice(0, MAX_CHARS_PER_URL);
      }
      const header = `Source: ${raw}`;
      const piece = `${header}\n${chunk}`;
      if (total + piece.length > MAX_TOTAL_CHARS) {
        const room = Math.max(0, MAX_TOTAL_CHARS - total - header.length - 2);
        if (room < 200) break;
        blocks.push(`${header}\n${chunk.slice(0, room)}`);
        break;
      }
      blocks.push(piece);
      total += piece.length + 2;
    } catch {
      /* skip bad or blocked URL */
    }
  }

  return blocks.join("\n\n").trim();
}
