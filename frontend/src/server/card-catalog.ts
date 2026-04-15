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

export function searchCardCatalog(raw: string, limit = 12): CardCatalogEntry[] {
  const q = normalize(raw);
  if (q.length < 2) return [];
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
    .slice(0, Math.min(Math.max(limit, 1), 25))
    .map((x) => x.entry);
}
