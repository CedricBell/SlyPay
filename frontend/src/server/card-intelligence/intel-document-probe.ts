import type { IntelDocumentKind } from "@/server/card-intelligence/discover-official-pdf-url";

const FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SpendLessCardIntel/1.0",
  accept:
    "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

export type IntelDocumentProbe = {
  reachable: boolean;
  status: number;
  kind: IntelDocumentKind;
};

/** Issuers often return 403 to bots on HEAD but still serve HTML on GET. */
function probeStatusUsable(status: number): boolean {
  return status >= 200 && status < 400;
}

function kindFromContentType(ct: string, path: string): IntelDocumentKind {
  const lower = ct.toLowerCase();
  if (lower.includes("application/pdf")) return "pdf";
  if (path.toLowerCase().endsWith(".pdf")) return "pdf";
  return "html";
}

/** HEAD then light GET — never treat marketing HTML paths as PDF from a lying Content-Type. */
export async function probeIntelDocumentUrl(
  raw: string,
): Promise<IntelDocumentProbe> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { reachable: false, status: 0, kind: "html" };
  }

  const path = parsed.pathname.toLowerCase();
  const likelyHtmlMarketing =
    /\/credit-cards?\//i.test(path) ||
    /\/card\//i.test(path) ||
    /\/digital-wallet\//i.test(path) ||
    /\/apple-card/i.test(path);

  try {
    const head = await fetch(parsed.toString(), {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(14_000),
      headers: FETCH_HEADERS,
    });
    if (head.ok) {
      const ct = head.headers.get("content-type") ?? "";
      let kind = kindFromContentType(ct, path);
      if (likelyHtmlMarketing && kind === "pdf") kind = "html";
      return { reachable: true, status: head.status, kind };
    }
    if (head.status === 403) {
      return { reachable: true, status: 403, kind: "html" };
    }
    if (head.status !== 405 && head.status !== 501) {
      return { reachable: false, status: head.status, kind: "html" };
    }
  } catch {
    /* try GET */
  }

  try {
    const get = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(18_000),
      headers: { ...FETCH_HEADERS, range: "bytes=0-12000" },
    });
    const ct = get.headers.get("content-type") ?? "";
    let kind = kindFromContentType(ct, path);
    if (likelyHtmlMarketing && kind === "pdf") kind = "html";
    const reachable = probeStatusUsable(get.status);
    return { reachable, status: get.status, kind };
  } catch {
    return { reachable: false, status: 0, kind: "html" };
  }
}

/** First candidate that returns HTTP 2xx wins. */
export async function pickFirstReachableIntelUrl(
  candidates: string[],
): Promise<{ url: string; kind: IntelDocumentKind } | null> {
  const seen = new Set<string>();
  for (const raw of candidates) {
    const norm = raw.trim();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    const probe = await probeIntelDocumentUrl(norm);
    if (probe.reachable || probe.status === 403) {
      return { url: norm, kind: probe.kind };
    }
  }
  return null;
}
