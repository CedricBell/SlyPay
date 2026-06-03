-- Admin-uploaded catalog PDF blobs (served via API for intel pipeline)
CREATE TABLE "CatalogDocumentBlob" (
    "productSlug" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileName" TEXT,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,

    CONSTRAINT "CatalogDocumentBlob_pkey" PRIMARY KEY ("productSlug")
);

ALTER TABLE "CatalogDocumentBlob" ADD CONSTRAINT "CatalogDocumentBlob_productSlug_fkey" FOREIGN KEY ("productSlug") REFERENCES "CardCatalogProduct"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
