const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 180_000;

/** Meta / JSON-LD often survives bot walls (e.g. Amazon /dp/ pages). */
function extractStructuredSnippets(rawHtml: string): string {
  const parts: string[] = [];
  const metaDesc = rawHtml.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  );
  if (metaDesc?.[1]?.trim()) parts.push(metaDesc[1].trim());

  const ogDesc = rawHtml.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  );
  if (ogDesc?.[1]?.trim()) parts.push(ogDesc[1].trim());

  const ldJsonBlocks = rawHtml.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of ldJsonBlocks) {
    const body = block[1]?.trim();
    if (!body || body.length > 80_000) continue;
    try {
      const data = JSON.parse(body) as unknown;
      const texts = collectJsonLdStrings(data);
      parts.push(...texts);
    } catch {
      parts.push(body.slice(0, 12_000));
    }
  }
  return [...new Set(parts)].join("\n\n");
}

function collectJsonLdStrings(node: unknown, depth = 0): string[] {
  if (depth > 8) return [];
  if (typeof node === "string" && node.length > 12) return [node];
  if (Array.isArray(node)) {
    return node.flatMap((x) => collectJsonLdStrings(x, depth + 1));
  }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    const keys = [
      "description",
      "name",
      "offers",
      "featureList",
      "additionalProperty",
    ];
    const out: string[] = [];
    for (const k of keys) {
      if (k in o) out.push(...collectJsonLdStrings(o[k], depth + 1));
    }
    return out;
  }
  return [];
}

/**
 * Crude HTML → plain text for LLM consumption (no DOM parser dependency).
 * Strips scripts/styles and tags; good enough for issuer terms pages.
 */
export function htmlDocumentToPlainText(rawHtml: string): string {
  if (rawHtml.length > MAX_HTML_BYTES) {
    rawHtml = rawHtml.slice(0, MAX_HTML_BYTES);
  }
  const structured = extractStructuredSnippets(rawHtml);
  let s = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 ? String.fromCharCode(code) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : " ";
    });

  s = s
    .replace(/\s+/g, " ")
    .replace(/\u200b/g, "")
    .trim();

  if (structured) {
    s = `${structured}\n\n${s}`.trim();
  }

  if (s.length > MAX_OUTPUT_CHARS) {
    s = s.slice(0, MAX_OUTPUT_CHARS);
  }
  return s;
}
