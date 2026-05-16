const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 180_000;

/**
 * Crude HTML → plain text for LLM consumption (no DOM parser dependency).
 * Strips scripts/styles and tags; good enough for issuer terms pages.
 */
export function htmlDocumentToPlainText(rawHtml: string): string {
  if (rawHtml.length > MAX_HTML_BYTES) {
    rawHtml = rawHtml.slice(0, MAX_HTML_BYTES);
  }
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

  if (s.length > MAX_OUTPUT_CHARS) {
    s = s.slice(0, MAX_OUTPUT_CHARS);
  }
  return s;
}
