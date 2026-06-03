/** Normalize merchant text for exclusion matching. */
export function normalizeMerchantToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_GROUPS: string[][] = [
  ["target", "target stores", "target.com", "target corporation"],
  ["walmart", "wal mart", "walmart.com", "wal-mart"],
  ["costco", "costco wholesale"],
  ["amazon", "amazon.com", "whole foods", "wholefoods"],
  ["sam's club", "sams club"],
];

function aliasTokens(token: string): string[] {
  const n = normalizeMerchantToken(token);
  if (!n) return [];
  const group = ALIAS_GROUPS.find((g) => g.some((a) => normalizeMerchantToken(a) === n || n.includes(normalizeMerchantToken(a))));
  if (group) return group.map(normalizeMerchantToken);
  return [n];
}

/** True when a purchase merchant is excluded from a category earn rule. */
export function isMerchantExcluded(
  merchantName: string | null | undefined,
  exclusions: string[] | null | undefined,
): boolean {
  if (!merchantName?.trim() || !exclusions?.length) return false;
  const merchantNorm = normalizeMerchantToken(merchantName);
  if (!merchantNorm) return false;

  for (const ex of exclusions) {
    const exNorm = normalizeMerchantToken(ex);
    if (!exNorm) continue;
    if (merchantNorm === exNorm) return true;
    if (merchantNorm.includes(exNorm) || exNorm.includes(merchantNorm)) return true;
    for (const alias of aliasTokens(ex)) {
      if (merchantNorm.includes(alias) || alias.includes(merchantNorm)) return true;
    }
  }
  return false;
}

export function formatMerchantExclusionNote(
  merchantName: string,
  categoryLabel: string,
): string {
  return `${merchantName} is excluded from ${categoryLabel} bonus earn on this card — using base rate instead.`;
}
