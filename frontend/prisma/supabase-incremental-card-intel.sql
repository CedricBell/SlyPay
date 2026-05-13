-- One-shot: Supabase → SQL Editor, coller tout ce fichier, Run.
-- Si une erreur « already exists », ta base est déjà à jour sur ce point — arrête et passe à `migrate resolve`.
-- Ensuite (terminal) : cd frontend && npx prisma migrate resolve --applied 20250320120000_init_schema

-- CreateEnum
CREATE TYPE "CardIntelJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED_NO_SOURCE');

-- CreateEnum
CREATE TYPE "CardCatalogExtractProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN     "catalogProductSlug" TEXT;

-- CreateTable
CREATE TABLE "CardCatalogProduct" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "colorHex" TEXT,
    "imageUrl" TEXT,
    "officialDocumentUrl" TEXT,
    "lastExtractHash" TEXT,
    "lastExtractJson" JSONB,
    "lastFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardCatalogProduct_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "CardCatalogExtractProposal" (
    "id" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "previousHash" TEXT,
    "proposedHash" TEXT NOT NULL,
    "proposedPayload" JSONB NOT NULL,
    "status" "CardCatalogExtractProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardCatalogExtractProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardIntelJob" (
    "id" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "creditCardId" TEXT,
    "status" "CardIntelJobStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardIntelJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardCatalogProduct_issuer_idx" ON "CardCatalogProduct"("issuer");

-- CreateIndex
CREATE INDEX "CardCatalogExtractProposal_productSlug_status_idx" ON "CardCatalogExtractProposal"("productSlug", "status");

-- CreateIndex
CREATE INDEX "CardCatalogExtractProposal_createdAt_idx" ON "CardCatalogExtractProposal"("createdAt");

-- CreateIndex
CREATE INDEX "CardIntelJob_productSlug_createdAt_idx" ON "CardIntelJob"("productSlug", "createdAt");

-- CreateIndex
CREATE INDEX "CardIntelJob_creditCardId_idx" ON "CardIntelJob"("creditCardId");

-- CreateIndex
CREATE INDEX "CreditCard_catalogProductSlug_idx" ON "CreditCard"("catalogProductSlug");

-- AddForeignKey
ALTER TABLE "CardCatalogExtractProposal" ADD CONSTRAINT "CardCatalogExtractProposal_productSlug_fkey" FOREIGN KEY ("productSlug") REFERENCES "CardCatalogProduct"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardIntelJob" ADD CONSTRAINT "CardIntelJob_productSlug_fkey" FOREIGN KEY ("productSlug") REFERENCES "CardCatalogProduct"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardIntelJob" ADD CONSTRAINT "CardIntelJob_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_catalogProductSlug_fkey" FOREIGN KEY ("catalogProductSlug") REFERENCES "CardCatalogProduct"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

