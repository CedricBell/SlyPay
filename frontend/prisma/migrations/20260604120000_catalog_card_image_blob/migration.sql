-- Issuer card art fetched server-side (served via /api/v1/catalog-card-images/:slug)
CREATE TABLE "CatalogCardImageBlob" (
    "productSlug" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "byteSize" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogCardImageBlob_pkey" PRIMARY KEY ("productSlug")
);

CREATE INDEX "CatalogCardImageBlob_fetchedAt_idx" ON "CatalogCardImageBlob"("fetchedAt");

ALTER TABLE "CatalogCardImageBlob" ADD CONSTRAINT "CatalogCardImageBlob_productSlug_fkey" FOREIGN KEY ("productSlug") REFERENCES "CardCatalogProduct"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
