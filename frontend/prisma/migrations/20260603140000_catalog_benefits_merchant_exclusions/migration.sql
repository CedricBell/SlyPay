-- Structured card benefits (credits, protections, perks) + merchant exclusions on reward rules

CREATE TYPE "CardBenefitKind" AS ENUM (
  'STATEMENT_CREDIT',
  'PROTECTION',
  'PERK',
  'WELCOME_OFFER',
  'LOYALTY'
);

CREATE TABLE "CardCatalogBenefit" (
  "id" TEXT NOT NULL,
  "catalogProductSlug" TEXT NOT NULL,
  "kind" "CardBenefitKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amountText" TEXT,
  "cadence" TEXT,
  "merchantHint" TEXT,
  "category" "SpendCategory",
  "coverageSummary" TEXT,
  "limitsText" TEXT,
  "enrollmentRequired" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CardCatalogBenefit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CardCatalogBenefit_catalogProductSlug_kind_idx"
  ON "CardCatalogBenefit"("catalogProductSlug", "kind");

ALTER TABLE "CardCatalogBenefit"
  ADD CONSTRAINT "CardCatalogBenefit_catalogProductSlug_fkey"
  FOREIGN KEY ("catalogProductSlug") REFERENCES "CardCatalogProduct"("slug")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RewardRule"
  ADD COLUMN "excludedMerchants" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
