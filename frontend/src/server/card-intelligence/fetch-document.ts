const MAX_BYTES = 15 * 1024 * 1024;

function assertAllowedHttpsUrl(raw: string): URL {
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
