/**
 * One-off: download + store card art for a catalog slug.
 * Usage: npx tsx scripts/hydrate-catalog-card-image.ts amex-platinum
 */
import { runCatalogImageJob } from "../src/server/catalog-image-pipeline";
import { prisma } from "../src/lib/prisma";

async function main() {
  const slug = process.argv[2]?.trim();
  if (!slug) {
    console.error("Usage: npx tsx scripts/hydrate-catalog-card-image.ts <slug>");
    process.exit(1);
  }

  const product = await prisma.cardCatalogProduct.findUnique({
    where: { slug },
  });
  if (!product) {
    console.error(`No CardCatalogProduct for slug: ${slug}`);
    process.exit(1);
  }

  const result = await runCatalogImageJob({
    productSlug: slug,
    issuer: product.issuer,
    cardName: product.name,
    forceRefresh: true,
  });

  const blob = await prisma.catalogCardImageBlob.findUnique({
    where: { productSlug: slug },
    select: { byteSize: true, sourceUrl: true, mimeType: true },
  });

  console.log(JSON.stringify({ ...result, blob }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
