/**
 * One-off: download + store card art for a catalog slug.
 * Usage: npx tsx scripts/hydrate-catalog-card-image.ts amex-platinum
 */
import { resolveAndPersistCatalogImage } from "../src/server/catalog-card-image";
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

  const url = await resolveAndPersistCatalogImage({
    productSlug: slug,
    issuer: product.issuer,
    cardName: product.name,
    currentImageUrl: product.imageUrl,
    officialDocumentUrl: product.officialDocumentUrl,
    forceRefresh: true,
  });

  const blob = await prisma.catalogCardImageBlob.findUnique({
    where: { productSlug: slug },
    select: { byteSize: true, sourceUrl: true, mimeType: true },
  });

  console.log(JSON.stringify({ imageUrl: url, blob }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
