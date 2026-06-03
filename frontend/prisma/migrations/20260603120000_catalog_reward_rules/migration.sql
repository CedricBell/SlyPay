-- Move RewardRule ownership from user wallet cards to canonical catalog products.

ALTER TABLE "RewardRule" ADD COLUMN "catalogProductSlug" TEXT;

UPDATE "RewardRule" AS rr
SET "catalogProductSlug" = cc."catalogProductSlug"
FROM "CreditCard" AS cc
WHERE rr."creditCardId" = cc.id
  AND cc."catalogProductSlug" IS NOT NULL;

DELETE FROM "RewardRule" WHERE "catalogProductSlug" IS NULL;

DELETE FROM "RewardRule" AS a
USING "RewardRule" AS b
WHERE a.id > b.id
  AND a."catalogProductSlug" = b."catalogProductSlug"
  AND a.category = b.category;

ALTER TABLE "RewardRule" DROP CONSTRAINT "RewardRule_creditCardId_fkey";
DROP INDEX IF EXISTS "RewardRule_creditCardId_category_idx";
ALTER TABLE "RewardRule" DROP COLUMN "creditCardId";

ALTER TABLE "RewardRule" ALTER COLUMN "catalogProductSlug" SET NOT NULL;

ALTER TABLE "RewardRule"
  ADD CONSTRAINT "RewardRule_catalogProductSlug_fkey"
  FOREIGN KEY ("catalogProductSlug")
  REFERENCES "CardCatalogProduct"("slug")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RewardRule_catalogProductSlug_category_idx"
  ON "RewardRule"("catalogProductSlug", "category");
