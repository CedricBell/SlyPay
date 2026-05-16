-- Issuer-published rotating 5% windows (per quarter), merged at recommendation time with user offers.
ALTER TABLE "CardCatalogProduct" ADD COLUMN IF NOT EXISTS "rotatingBonusCalendar" JSONB;
