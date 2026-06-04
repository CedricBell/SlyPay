import {
  CARD_CATALOG_ENTRIES,
  CURATED_CATALOG_IMAGE_URLS,
} from "@/server/card-catalog.entries";
import type { CardCatalogEntry } from "@/server/card-catalog.types";

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match static catalog art when slug is adhoc but issuer + name are known (e.g. Amex Platinum). */
export function resolveCatalogImageUrlByIssuerAndName(
  issuer: string,
  cardName: string,
): string | undefined {
  const issuerN = normalizeKey(issuer);
  const nameN = normalizeKey(cardName);
  if (!issuerN || !nameN) return undefined;

  let best: { url: string; score: number } | null = null;

  for (const entry of CARD_CATALOG_ENTRIES) {
    if (normalizeKey(entry.issuer) !== issuerN) continue;
    const entryNameN = normalizeKey(entry.name);
    const url =
      CURATED_CATALOG_IMAGE_URLS[entry.id] ??
      entry.imageUrl ??
      undefined;
    if (!url?.trim() || isPlaceholderImageUrl(url)) continue;

    let score = 0;
    if (entryNameN === nameN) score += 200;
    else if (entryNameN.includes(nameN) || nameN.includes(entryNameN)) {
      score += 90;
    } else {
      const terms = nameN.split(" ").filter((t) => t.length > 2);
      for (const t of terms) {
        if (entryNameN.includes(t)) score += 15;
      }
    }
    if (score >= 36 && (!best || score > best.score)) {
      best = { url: url.trim(), score };
    }
  }
  return best?.url;
}

export function isPlaceholderImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  return url.includes("placehold.co");
}

/** Prefer curated issuer art, then DB, then static catalog — never a broken placeholder URL. */
export function resolveCatalogImageUrl(
  slug: string,
  overrides?: {
    imageUrl?: string | null;
    imageLabel?: string;
  },
): string | undefined {
  const candidates = [
    overrides?.imageUrl,
    CURATED_CATALOG_IMAGE_URLS[slug],
    CARD_CATALOG_ENTRIES.find((e) => e.id === slug)?.imageUrl,
  ];
  for (const url of candidates) {
    if (url?.trim() && !isPlaceholderImageUrl(url)) return url.trim();
  }
  return undefined;
}

export function enrichCatalogEntry(entry: CardCatalogEntry): CardCatalogEntry {
  const imageUrl = resolveCatalogImageUrl(entry.id, {
    imageUrl: entry.imageUrl,
    imageLabel: entry.name,
  });
  const fallback =
    entry.imageUrl && !isPlaceholderImageUrl(entry.imageUrl)
      ? entry.imageUrl
      : undefined;
  return {
    ...entry,
    imageUrl: imageUrl ?? fallback,
  };
}

export function mergeCatalogEntries(
  primary: CardCatalogEntry,
  secondary: CardCatalogEntry,
): CardCatalogEntry {
  const imageUrl =
    resolveCatalogImageUrl(primary.id, { imageUrl: primary.imageUrl }) ??
    resolveCatalogImageUrl(secondary.id, { imageUrl: secondary.imageUrl });

  return {
    ...secondary,
    ...primary,
    imageUrl: imageUrl ?? primary.imageUrl ?? secondary.imageUrl,
    colorHex: primary.colorHex ?? secondary.colorHex,
    officialDocumentUrl:
      primary.officialDocumentUrl ?? secondary.officialDocumentUrl,
    rotatingBonusCalendar:
      primary.rotatingBonusCalendar ?? secondary.rotatingBonusCalendar,
  };
}
