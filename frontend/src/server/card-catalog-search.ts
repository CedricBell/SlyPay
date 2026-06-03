import { CARD_CATALOG_ENTRIES } from "./card-catalog.entries";
import type { CardCatalogEntry } from "./card-catalog.types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function catalogBrowseSorted(limit: number): CardCatalogEntry[] {
  const cap = Math.min(Math.max(limit, 1), 200);
  return [...CARD_CATALOG_ENTRIES]
    .sort((a, b) =>
      `${a.issuer} ${a.name}`.localeCompare(`${b.issuer} ${b.name}`, undefined, {
        sensitivity: "base",
      }),
    )
    .slice(0, cap);
}

export type ScoredCatalogEntry = { entry: CardCatalogEntry; score: number };

export function searchCardCatalogScored(
  raw: string,
  limit = 12,
): ScoredCatalogEntry[] {
  const cap = Math.min(Math.max(limit, 1), 200);
  const q = normalize(raw.trim());
  if (q.length === 0) {
    return catalogBrowseSorted(cap).map((entry) => ({ entry, score: 0 }));
  }

  const terms = q.split(" ").filter(Boolean);

  const scored = CARD_CATALOG_ENTRIES.map((entry) => {
    const hay = normalize(`${entry.name} ${entry.issuer}`);
    if (!terms.every((t) => hay.includes(t))) {
      return { entry, score: -1 };
    }
    let score = 0;
    const nameN = normalize(entry.name);
    const issuerN = normalize(entry.issuer);
    if (nameN.startsWith(q) || hay.startsWith(q)) score += 100;
    if (nameN.includes(q)) score += 50;
    if (issuerN.includes(q)) score += 30;
    for (const t of terms) {
      if (nameN.includes(t)) score += 10;
      if (issuerN.includes(t)) score += 5;
    }
    return { entry, score };
  });

  return scored
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
}

export function searchCardCatalog(raw: string, limit = 12): CardCatalogEntry[] {
  return searchCardCatalogScored(raw, limit).map((x) => x.entry);
}
