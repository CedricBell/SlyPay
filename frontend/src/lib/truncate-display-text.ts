/**
 * Truncate for UI without cutting mid-word or mid-sentence when possible.
 */
export function truncateAtSentenceBoundary(
  text: string,
  maxLen: number,
): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;

  const window = t.slice(0, maxLen + 1);
  const lastSentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf("; "),
  );
  if (lastSentence >= Math.floor(maxLen * 0.45)) {
    return t.slice(0, lastSentence + 1).trim();
  }

  const lastSpace = window.lastIndexOf(" ");
  if (lastSpace >= Math.floor(maxLen * 0.55)) {
    return `${t.slice(0, lastSpace).trim()}…`;
  }

  return `${t.slice(0, maxLen).trim()}…`;
}

export function formatProtectionHint(title: string, coverage: string): string {
  const t = title.trim();
  const c = coverage.trim();
  if (!c) return t;
  if (!t || c.toLowerCase().startsWith(t.toLowerCase())) {
    return truncateAtSentenceBoundary(c, 220);
  }
  const combined = `${t}: ${c}`;
  return truncateAtSentenceBoundary(combined, 220);
}

/** Same one-line format as protections — used for lounge, hotel programs, status, etc. */
export function formatPerkHint(title: string, description: string): string {
  return formatProtectionHint(title, description);
}
