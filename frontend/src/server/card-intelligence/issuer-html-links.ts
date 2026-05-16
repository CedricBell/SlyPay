/** Shared HTML link extraction for issuer-site intel (no DOM parser). */

export type AnchorLink = { url: string; anchorText: string };

export async function fetchIssuerHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(18_000),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SpendLessCardIntel/1.0",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 1_500_000) return null;
    return Buffer.from(buf).toString("utf8");
  } catch {
    return null;
  }
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Anchor href + visible text (for « Rewards and rules » style buttons). */
export function extractAnchorLinks(html: string, base: URL): AnchorLink[] {
  const out: AnchorLink[] = [];
  const re =
    /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
      continue;
    }
    try {
      const u = new URL(href, base);
      if (u.protocol !== "https:") continue;
      u.hash = "";
      const anchorText = stripTags(m[2]);
      out.push({ url: u.toString(), anchorText });
    } catch {
      /* skip */
    }
  }
  return out;
}

export function extractHttpsLinks(html: string, base: URL): string[] {
  const seen = new Set<string>();
  for (const { url } of extractAnchorLinks(html, base)) {
    seen.add(url);
  }
  return [...seen];
}
