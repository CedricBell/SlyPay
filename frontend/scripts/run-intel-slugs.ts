/**
 * Run intel for specific catalog slugs.
 * Usage: npx tsx scripts/run-intel-slugs.ts slug1 slug2 [--force]
 */
import { prisma } from "../src/lib/prisma";
import { syncAllCatalogProductsToDb } from "../src/server/catalog-db-sync";
import { runCardIntelJob } from "../src/server/card-intelligence/run-intel-job";

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const slugs = argv.filter((a) => a !== "--force");

async function main() {
  if (!slugs.length) {
    console.error("Provide at least one slug");
    process.exit(1);
  }
  await syncAllCatalogProductsToDb();
  for (const slug of slugs) {
    process.stdout.write(`• ${slug} … `);
    await runCardIntelJob({ productSlug: slug, forceReanalyze: force });
    const job = await prisma.cardIntelJob.findFirst({
      where: { productSlug: slug },
      orderBy: { createdAt: "desc" },
      select: { status: true, errorMessage: true },
    });
    const rules = await prisma.rewardRule.count({
      where: { catalogProductSlug: slug },
    });
    console.log(
      job?.status ?? "unknown",
      `rules=${rules}`,
      job?.errorMessage?.slice(0, 100) ?? "",
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
