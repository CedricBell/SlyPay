/**
 * Trace image pipeline stages for one catalog slug.
 * Usage: npx tsx scripts/trace-catalog-image.ts chase-sapphire-reserve
 */
import { prisma } from "../src/lib/prisma";
import { CURATED_CATALOG_IMAGE_URLS } from "../src/server/card-catalog.entries";
import { downloadCatalogCardImage } from "../src/server/catalog-card-image-download";
import {
  buildHumanCardImageSearchQuery,
  discoverCatalogCardImageHumanFirst,
  discoverCatalogCardImageViaImageSearch,
  serpApiImageSearchEnabled,
} from "../src/server/catalog-card-image-search";
import { guessBuiltInCardArtUrls } from "../src/server/catalog-image-resolve";
import {
  catalogImageIsIssuerExactPath,
  catalogImageUrlAllowedForHumanSearchPersist,
  catalogImageUrlAllowedForPersist,
  catalogImageUrlHasConflictingVariant,
  catalogImageUrlMatchesProductSlug,
  isCuratedCatalogImageUrl,
  isMarketingBannerImagePath,
  scoreCatalogImageUrl,
} from "../src/server/catalog-image-match";

const slug = process.argv[2]?.trim() ?? "chase-sapphire-reserve";

async function probeUrl(
  url: string,
  label: string,
  extra?: Record<string, unknown>,
) {
  const dl = await downloadCatalogCardImage(url);
  console.log(`  ${label}`);
  console.log(`    url: ${url}`);
  if (extra) console.log(`    meta:`, extra);
  console.log(`    download: ${dl ? `OK ${dl.byteSize}b ${dl.mimeType}` : "FAIL"}`);
}

async function main() {
  const product = await prisma.cardCatalogProduct.findUnique({
    where: { slug },
  });
  const blob = await prisma.catalogCardImageBlob.findUnique({
    where: { productSlug: slug },
    select: { sourceUrl: true, byteSize: true, mimeType: true, fetchedAt: true },
  });

  console.log(`\n=== TRACE: ${slug} ===\n`);
  console.log("DB product:", {
    name: product?.name,
    issuer: product?.issuer,
    imageUrl: product?.imageUrl,
  });
  console.log("Stored blob:", blob ?? "(none)");

  const issuer = product?.issuer ?? "Chase";
  const cardName = product?.name ?? "Sapphire Reserve";

  console.log("\n--- STAGE 0: cache ---");
  if (blob && !process.argv.includes("--force")) {
    console.log("  Would return cached blob (use --force to trace full pipeline)");
  } else {
    console.log("  No cache or --force → continue pipeline");
  }

  console.log("\n--- STAGE 1: curated ---");
  const curated = CURATED_CATALOG_IMAGE_URLS[slug]?.trim();
  console.log("  curated URL:", curated ?? "(none)");
  if (curated) {
    const allowed = catalogImageUrlAllowedForPersist({
      url: curated,
      productSlug: slug,
      issuer,
      cardName,
    });
    console.log("  allowedForPersist:", allowed);
    await probeUrl(curated, "curated");
  }

  console.log("\n--- STAGE 2: issuer-dam (high-trust guesses) ---");
  const damAll = guessBuiltInCardArtUrls({ productSlug: slug, issuer, cardName });
  const damTrusted = damAll.filter(
    (u) =>
      isCuratedCatalogImageUrl(slug, u) ||
      catalogImageIsIssuerExactPath(u, slug),
  );
  console.log("  trusted URLs:", damTrusted.length);
  for (const u of damTrusted.slice(0, 5)) {
    const allowed = catalogImageUrlAllowedForPersist({
      url: u,
      productSlug: slug,
      issuer,
      cardName,
    });
    await probeUrl(u, "issuer-dam", { allowed });
  }

  console.log("\nSerpAPI enabled:", serpApiImageSearchEnabled());
  console.log("\n--- STAGE 3: serpapi-human ---");
  const q = buildHumanCardImageSearchQuery(issuer, cardName);
  console.log("  query:", q);
  const humanHits = await discoverCatalogCardImageHumanFirst({
    issuer,
    cardName,
    productSlug: slug,
  });
  for (let i = 0; i < Math.min(8, humanHits.length); i++) {
    const hit = humanHits[i]!;
    const allowed = catalogImageUrlAllowedForHumanSearchPersist({
      url: hit.url,
      title: hit.title,
      productSlug: slug,
      issuer,
      cardName,
      searchRank: hit.rank,
    });
    const banner = isMarketingBannerImagePath(hit.url);
    const conflict = catalogImageUrlHasConflictingVariant({
      url: hit.url,
      cardName,
      productSlug: slug,
      issuer,
    });
    const slugMatch = catalogImageUrlMatchesProductSlug({
      url: hit.url,
      productSlug: slug,
      issuer,
    });
    const score = scoreCatalogImageUrl({
      url: hit.url,
      hint: hit.title,
      cardName,
      productSlug: slug,
      issuer,
      resultIndex: hit.rank,
    });
    console.log(`  #${hit.rank} [${hit.provider}] allowed=${allowed} banner=${banner} conflict=${conflict} slugMatch=${slugMatch} score=${score}`);
    console.log(`    title: ${hit.title.slice(0, 80)}`);
    console.log(`    url: ${hit.url}`);
    const dl = await downloadCatalogCardImage(hit.url);
    console.log(`    download: ${dl ? `OK ${dl.byteSize}b` : "FAIL"}`);
    if (allowed && dl && !banner && score >= 0) {
      console.log("    >>> viable human candidate");
    }
  }

  console.log("\n--- STAGE 4: serpapi-ranked ---");
  const ranked = await discoverCatalogCardImageViaImageSearch({
    issuer,
    cardName,
    productSlug: slug,
  });
  console.log("  ranked candidates:", ranked.length);
  for (let i = 0; i < Math.min(6, ranked.length); i++) {
    const hit = ranked[i]!;
    const allowed = catalogImageUrlAllowedForPersist({
      url: hit.url,
      productSlug: slug,
      issuer,
      cardName,
      title: hit.title,
    });
    console.log(`  #${i} score=${hit.score} allowed=${allowed}`);
    console.log(`    title: ${hit.title.slice(0, 80)}`);
    console.log(`    ${hit.url}`);
    const dl = await downloadCatalogCardImage(hit.url);
    console.log(`    download: ${dl ? `OK` : "FAIL"}`);
    if (allowed && dl) {
      console.log("    >>> WOULD WIN at serpapi-ranked stage");
      break;
    }
  }

  console.log("\n--- STAGE 5: scrape (skipped in trace — slow) ---");
  console.log("  Would scrape issuer product pages for og:image\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
