import { syncAllCatalogProductsToDb } from "../src/server/catalog-db-sync";
import { prisma } from "../src/lib/prisma";

async function main() {
  await syncAllCatalogProductsToDb();
  const count = await prisma.cardCatalogProduct.count();
  console.log(`Catalog synced — ${count} CardCatalogProduct row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
