const MAX_BYTES = 15 * 1024 * 1024;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

export function assertAllowedHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid document URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Only https:// document URLs are allowed");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    throw new Error("Local hosts are not allowed for document fetch");
  }
  return url;
}

export async function fetchPdfBuffer(documentUrl: string): Promise<Buffer> {
  assertAllowedHttpsUrl(documentUrl);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch(documentUrl, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "user-agent": "SpendLessCardIntel/1.0",
        accept: "application/pdf,*/*",
      },
    });
    if (!res.ok) {
      throw new Error(`Document fetch failed: HTTP ${res.status}`);
    }
    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const n = Number(lenHeader);
      if (Number.isFinite(n) && n > MAX_BYTES) {
        throw new Error("Document exceeds maximum size");
      }
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("Document exceeds maximum size");
    }
    return buf;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetches an HTML document (terms / disclosures). Same SSRF rules as PDF fetch.
 * Accepts `text/html` or XHTML; if Content-Type is wrong but body starts like HTML, still parses downstream.
 */
export async function fetchHtmlDocument(documentUrl: string): Promise<string> {
  assertAllowedHttpsUrl(documentUrl);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch(documentUrl, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "user-agent": "SpendLessCardIntel/1.0",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      },
    });
    if (!res.ok) {
      throw new Error(`Document fetch failed: HTTP ${res.status}`);
    }
    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const n = Number(lenHeader);
      if (Number.isFinite(n) && n > MAX_HTML_BYTES) {
        throw new Error("HTML document exceeds maximum size");
      }
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_HTML_BYTES) {
      throw new Error("HTML document exceeds maximum size");
    }
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const head = buf.toString("utf8", 0, Math.min(512, buf.length)).trimStart();
    const looksHtml =
      ct.includes("text/html") ||
      ct.includes("application/xhtml") ||
      ct.includes("text/plain") ||
      head.startsWith("<!") ||
      head.toLowerCase().startsWith("<html");
    if (!looksHtml) {
      throw new Error("URL did not return HTML suitable for text extraction");
    }
    return buf.toString("utf8");
  } finally {
    clearTimeout(t);
  }
}

