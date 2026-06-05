/**
 * Run the dedicated card image pipeline for every catalog product.
 * Usage: npx tsx scripts/run-all-catalog-images.ts [--force]
 */
import { prisma } from "../src/lib/prisma";
import { syncAllCatalogProductsToDb } from "../src/server/catalog-db-sync";
import { runCatalogImageJob } from "../src/server/catalog-image-pipeline";

async function main() {
  const force = process.argv.includes("--force");
  await syncAllCatalogProductsToDb();

  const products = await prisma.cardCatalogProduct.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true, name: true, issuer: true },
  });

  if (!products.length) {
    console.log("No catalog products in database.");
    return;
  }

  console.log(`Running image pipeline for ${products.length} product(s)…`);
  let ok = 0;
  let skip = 0;
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
        console.log(result.stage ?? "ok");
      } else if (result.status === "SKIPPED") {
        skip++;
        console.log("SKIP", result.errorMessage?.slice(0, 60) ?? "");
      } else {
        fail++;
        console.log("FAIL", result.errorMessage?.slice(0, 60) ?? "");
      }
    } catch (e) {
      fail++;
      console.log("ERROR", e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done. completed=${ok} skipped=${skip} failed=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
