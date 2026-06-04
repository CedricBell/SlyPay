import { prisma } from "@/lib/prisma";
import {
  enrichCatalogEntry,
  mergeCatalogEntries,
} from "@/server/catalog-card-art";
import type { CardCatalogEntry } from "./card-catalog.types";
import { searchCardCatalog } from "./card-catalog-search";
import { isAdHocCatalogIntelEligible } from "./catalog-intel-eligibility";
import {
  inferIssuerAndProductNameDetailed,
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
  if (qt.length < 3 || !isAdHocCatalogIntelEligible(qt)) {
    return merged.slice(0, cap);
  }

  const staticMatch = searchCardCatalog(qt, 1)[0];
  if (staticMatch && !staticMatch.id.startsWith("adhoc-")) {
    return merged.slice(0, cap);
  }

  const inferred = inferIssuerAndProductNameDetailed(qt);
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

  return [...merged, synthetic].slice(0, cap);
}

export { searchCardCatalog, searchCardCatalogScored } from "./card-catalog-search";
export type { ScoredCatalogEntry } from "./card-catalog-search";

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
      for (const e of staticHits) {
        byId.set(e.id, enrichCatalogEntry(e));
      }
      for (const e of dbEntries) {
        const prev = byId.get(e.id);
        byId.set(
          e.id,
          prev ? mergeCatalogEntries(enrichCatalogEntry(e), prev) : enrichCatalogEntry(e),
        );
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
    for (const e of staticHits) {
      byId.set(e.id, enrichCatalogEntry(e));
    }
    for (const e of dbEntries) {
      const prev = byId.get(e.id);
      byId.set(
        e.id,
        prev ? mergeCatalogEntries(enrichCatalogEntry(e), prev) : enrichCatalogEntry(e),
      );
    }
    return maybePrependTypedCatalogSuggestion(q, [...byId.values()], cap);
  } catch {
    return maybePrependTypedCatalogSuggestion(q, staticHits, cap);
  }
}
