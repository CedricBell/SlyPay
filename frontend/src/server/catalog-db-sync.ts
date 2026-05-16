import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stableAdHocCatalogSlug } from "@/server/catalog-infer";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";

/** Upserts one row in `CardCatalogProduct` from the in-repo catalog (slug = entry id). */
export async function upsertCatalogProductFromSlug(slug: string) {
  const entry = CARD_CATALOG_ENTRIES.find((e) => e.id === slug);
  if (!entry) return null;

  const docUrl = entry.officialDocumentUrl ?? null;
  const rotating = entry.rotatingBonusCalendar;
  const rotatingJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    rotating && rotating.length > 0
      ? (rotating as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  return prisma.cardCatalogProduct.upsert({
    where: { slug: entry.id },
    create: {
      slug: entry.id,
      name: entry.name,
      issuer: entry.issuer,
      colorHex: entry.colorHex ?? null,
      imageUrl: entry.imageUrl ?? null,
      officialDocumentUrl: docUrl,
      rotatingBonusCalendar: rotatingJson,
    },
    update: {
      name: entry.name,
      issuer: entry.issuer,
      colorHex: entry.colorHex ?? null,
      imageUrl: entry.imageUrl ?? null,
      ...(docUrl ? { officialDocumentUrl: docUrl } : {}),
      rotatingBonusCalendar: rotatingJson,
    },
  });
}

/**
 * Resolves a catalog product for linking a new card: static file upsert, or an
 * existing `CardCatalogProduct` row (e.g. admin-seeded / prior ad-hoc).
 */
export async function resolveCatalogProductFromSlug(slug: string) {
  const fromStatic = await upsertCatalogProductFromSlug(slug);
  if (fromStatic) return fromStatic;
  return prisma.cardCatalogProduct.findUnique({ where: { slug } });
}

/** Creates or updates the DB row for a user-typed card before running PDF intel. */
export async function ensureAdHocCatalogProduct(args: {
  name: string;
  issuer: string;
  colorHex?: string | null;
}) {
  const slug = stableAdHocCatalogSlug(args.issuer, args.name);
  return prisma.cardCatalogProduct.upsert({
    where: { slug },
    create: {
      slug,
      name: args.name,
      issuer: args.issuer,
      colorHex: args.colorHex ?? null,
    },
    update: {
      name: args.name,
      issuer: args.issuer,
      ...(args.colorHex ? { colorHex: args.colorHex } : {}),
    },
  });
}

/** Seeds every catalog slug — optional helper for migrations / admin scripts. */
export async function syncAllCatalogProductsToDb() {
  for (const entry of CARD_CATALOG_ENTRIES) {
    await upsertCatalogProductFromSlug(entry.id);
  }
}
