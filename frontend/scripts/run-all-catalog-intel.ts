/**
 * Run card intel pipeline for every catalog product in the database.
 * Usage: npx tsx scripts/run-all-catalog-intel.ts [--force]
 */
import { prisma } from "../src/lib/prisma";
import { syncAllCatalogProductsToDb } from "../src/server/catalog-db-sync";
import { runCardIntelJob } from "../src/server/card-intelligence/run-intel-job";

async function main() {
  const force = process.argv.includes("--force");
  const products = await prisma.cardCatalogProduct.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true, name: true },
  });

  if (!products.length) {
    console.log("No catalog products in database.");
    return;
  }

  await syncAllCatalogProductsToDb();
  console.log("Synced catalog entries → database.");

  console.log(`Running intel for ${products.length} catalog product(s)…`);
  let ok = 0;
  let fail = 0;

  for (const p of products) {
    process.stdout.write(`• ${p.slug} … `);
    try {
      await runCardIntelJob({
        productSlug: p.slug,
        forceReanalyze: force,
      });
      const job = await prisma.cardIntelJob.findFirst({
        where: { productSlug: p.slug },
        orderBy: { createdAt: "desc" },
        select: { status: true, errorMessage: true },
      });
      if (job?.status === "COMPLETED") {
        ok++;
        console.log("COMPLETED");
      } else {
        fail++;
        console.log(job?.status ?? "unknown", job?.errorMessage?.slice(0, 80) ?? "");
      }
    } catch (e) {
      fail++;
      console.log("ERROR", e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done. completed=${ok} other=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
