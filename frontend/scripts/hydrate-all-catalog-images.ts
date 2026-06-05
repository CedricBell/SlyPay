/**
 * Re-download and store official card art for every catalog product.
 * Usage: npx tsx scripts/hydrate-all-catalog-images.ts [--force]
 */
import { runCatalogImageJob } from "../src/server/catalog-image-pipeline";
import { prisma } from "../src/lib/prisma";

async function main() {
  const force = process.argv.includes("--force");
  const products = await prisma.cardCatalogProduct.findMany({
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      name: true,
      issuer: true,
      imageUrl: true,
      officialDocumentUrl: true,
    },
  });

  if (!products.length) {
    console.log("No catalog products in database.");
    return;
  }

  console.log(`Hydrating images for ${products.length} product(s)…`);
  let ok = 0;
  let fail = 0;

  for (const p of products) {
    process.stdout.write(`• ${p.slug} … `);
    try {
      const result = await runCatalogImageJob({
        productSlug: p.slug,
        issuer: p.issuer,
        cardName: p.name,
        forceRefresh: force,
      });
      if (result.status === "COMPLETED") {
        ok++;
        console.log(result.stage ?? "OK");
      } else {
        fail++;
        console.log(result.status, result.errorMessage?.slice(0, 60) ?? "");
      }
    } catch (e) {
      fail++;
      console.log("FAIL", e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done. ok=${ok} fail/skip=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
