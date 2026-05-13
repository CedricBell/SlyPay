import { prisma } from "@/lib/prisma";
import { CARD_CATALOG_ENTRIES } from "./card-catalog.entries";
import type { CardCatalogEntry } from "./card-catalog.types";
import {
  inferIssuerAndProductName,
  stableAdHocCatalogSlug,
} from "./catalog-infer";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function maybePrependTypedCatalogSuggestion(
  rawQuery: string,
  merged: CardCatalogEntry[],
  cap: number,
): CardCatalogEntry[] {
  const qt = rawQuery.trim();
  if (qt.length < 3) return merged.slice(0, cap);

  const inferred = inferIssuerAndProductName(qt);
  if (!inferred) return merged.slice(0, cap);

  const slug = stableAdHocCatalogSlug(inferred.issuer, inferred.name);
  if (merged.some((e) => e.id === slug)) return merged.slice(0, cap);

  const synthetic: CardCatalogEntry = {
    id: slug,
    name: inferred.name,
    issuer: inferred.issuer,
    rules: [],
    intelAdHocFromName: true,
  };

  return [synthetic, ...merged].slice(0, cap);
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

export function searchCardCatalog(raw: string, limit = 12): CardCatalogEntry[] {
  const cap = Math.min(Math.max(limit, 1), 200);
  const q = normalize(raw.trim());
  if (q.length === 0) {
    return catalogBrowseSorted(cap);
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
    .slice(0, cap)
    .map((x) => x.entry);
}

/** Static catalog plus rows déjà présentes en base (`CardCatalogProduct`). */
export async function searchCardCatalogMerged(
  raw: string,
  limit = 12,
): Promise<CardCatalogEntry[]> {
  const cap = Math.min(Math.max(limit, 1), 200);
  const q = raw.trim();
  const staticHits = searchCardCatalog(raw, cap);

  if (q.length === 0) {
    try {
      const dbRows = await prisma.cardCatalogProduct.findMany({
        take: cap,
        orderBy: [{ issuer: "asc" }, { name: "asc" }],
      });
      const dbEntries: CardCatalogEntry[] = dbRows.map((row) => ({
        id: row.slug,
        name: row.name,
        issuer: row.issuer,
        colorHex: row.colorHex ?? undefined,
        imageUrl: row.imageUrl ?? undefined,
        officialDocumentUrl: row.officialDocumentUrl ?? undefined,
        rules: [],
      }));
      const byId = new Map<string, CardCatalogEntry>();
      for (const e of [...dbEntries, ...staticHits]) {
        if (!byId.has(e.id)) byId.set(e.id, e);
      }
      return [...byId.values()].slice(0, cap);
    } catch {
      return staticHits;
    }
  }

  try {
    const nq = normalize(q);
    const slugHint = nq.replace(/\s+/g, "-");
    const dbRows = await prisma.cardCatalogProduct.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { issuer: { contains: q, mode: "insensitive" } },
          { slug: { contains: slugHint, mode: "insensitive" } },
        ],
      },
      take: cap,
      orderBy: { updatedAt: "desc" },
    });

    const dbEntries: CardCatalogEntry[] = dbRows.map((row) => ({
      id: row.slug,
      name: row.name,
      issuer: row.issuer,
      colorHex: row.colorHex ?? undefined,
      imageUrl: row.imageUrl ?? undefined,
      officialDocumentUrl: row.officialDocumentUrl ?? undefined,
      rules: [],
    }));

    const byId = new Map<string, CardCatalogEntry>();
    for (const e of [...dbEntries, ...staticHits]) {
      if (!byId.has(e.id)) byId.set(e.id, e);
    }
    return maybePrependTypedCatalogSuggestion(q, [...byId.values()], cap);
  } catch {
    return maybePrependTypedCatalogSuggestion(q, staticHits, cap);
  }
}
