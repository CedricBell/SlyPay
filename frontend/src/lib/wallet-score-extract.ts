function parseMoneyFromText(s: string): number {
  let total = 0;
  const re = /\$[\d,]+(?:\.\d{2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[0].slice(1).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

export function parseAnnualFeeDollarsFromExtract(json: unknown): number {
  if (!json || typeof json !== "object") return 0;
  const o = json as Record<string, unknown>;
  const af = o.annualFee;
  if (af && typeof af === "object") {
    const t = String((af as { amountText?: string }).amountText ?? "");
    const d = parseMoneyFromText(t);
    if (d > 0 && d < 8000) return d;
  }
  const caveats = Array.isArray(o.caveats)
    ? (o.caveats as unknown[]).map((c) => String(c)).join(" ")
    : "";
  const blob = `${String(o.summary ?? "")} ${caveats}`.toLowerCase();
  const patterns: RegExp[] = [
    /annual\s+(?:membership\s+)?fee[^$\d]{0,48}\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:\/\s*year|per\s+year|annual(?:ly)?|\/yr\b)/i,
    /(?:^|[\s,])\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:annual|\/yr|per\s+year)\s+fee/i,
  ];
  let best = 0;
  for (const re of patterns) {
    const m = blob.match(re);
    if (m?.[1]) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0 && n < 8000) best = Math.max(best, n);
    }
  }
  return best;
}
