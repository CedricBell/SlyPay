/**
 * Debug intel discovery for specific catalog slugs.
 * Usage: npx tsx scripts/diagnose-intel-slugs.ts slug1 slug2 ...
 */
import { prisma } from "../src/lib/prisma";
import { CARD_CATALOG_ENTRIES } from "../src/server/card-catalog.entries";
import { probeIntelDocumentUrl } from "../src/server/card-intelligence/intel-document-probe";
import { fetchWebSearchHits } from "../src/server/card-intelligence/intel-web-search";
import { buildMinimalHumanSearchQuery } from "../src/server/card-intelligence/pdf-discovery-query";
import { discoverOfficialPdfUrl } from "../src/server/card-intelligence/discover-official-pdf-url";

const slugs =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : [
        "amazon-store-card",
        "citi-double-cash",
        "usbank-altitude-go",
        "usbank-cash-plus",
      ];

async function main() {
  for (const slug of slugs) {
    const entry = CARD_CATALOG_ENTRIES.find((e) => e.id === slug);
    const row = await prisma.cardCatalogProduct.findUnique({
      where: { slug },
      select: { officialDocumentUrl: true, name: true, issuer: true },
    });
    console.log(`\n=== ${slug} ===`);
    console.log("DB url:", row?.officialDocumentUrl ?? "(null)");
    console.log("Entry curated:", entry?.officialDocumentUrl ?? "(null)");

    for (const label of ["DB", "Curated"] as const) {
      const u =
        label === "DB" ? row?.officialDocumentUrl : entry?.officialDocumentUrl;
      if (!u) continue;
      const p = await probeIntelDocumentUrl(u);
      console.log(`${label} probe:`, p.status, p.reachable, u);
    }

    const cardName = row?.name ?? entry?.name ?? slug;
    const issuer = row?.issuer ?? entry?.issuer ?? "";
    const q = buildMinimalHumanSearchQuery({ cardName, productSlug: slug });
    console.log("Brave query:", q);
    const hits = await fetchWebSearchHits(q);
    for (let i = 0; i < Math.min(4, hits.length); i++) {
      const h = hits[i]!;
      const p = await probeIntelDocumentUrl(h.url);
      console.log(
        `  #${i} ${p.reachable ? "OK" : `HTTP ${p.status}`}`,
        h.url,
      );
    }

    const discovered = await discoverOfficialPdfUrl({
      issuer,
      cardName,
      productSlug: slug,
    });
    console.log("discoverOfficialPdfUrl:", discovered.url, discovered.sourceKind);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
