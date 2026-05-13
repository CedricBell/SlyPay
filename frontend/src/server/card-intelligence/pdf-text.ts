import { createRequire } from "node:module";
import type { Buffer } from "node:buffer";

const require = createRequire(import.meta.url);
/**
 * Load `lib/pdf-parse.js` only — never `pdf-parse/index.js`: that file runs a
 * "debug" block when `module.parent` is falsy (common when bundled), which
 * tries to read `./test/data/05-versions-space.pdf` and throws ENOENT.
 * v2 of pdf-parse pulls pdfjs-dist 5 + canvas and breaks on Node 20.
 */
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  data: Buffer | Uint8Array,
) => Promise<{ text?: string }>;

export async function pdfBufferToText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  const text = typeof result.text === "string" ? result.text : "";
  return text.replace(/\u0000/g, "").trim();
}
