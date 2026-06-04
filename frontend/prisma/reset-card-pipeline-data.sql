-- Reset pipeline Card Intel + extractions, sans toucher aux utilisateurs / wallets / marchands.
-- Conserve :
--   • CardCatalogProduct du catalogue statique (noms / issuers / slugs connus)
--   • KnownIssuer (domaines émetteurs appris en base)
--   • ISSUER_SAFELIST (dans le code — issuer-safelist.ts, rien à faire en SQL)
--   • CreditCard, User, Offer, Merchant, Transaction, Recommendation
--
-- À exécuter dans l’éditeur SQL Supabase (ou psql), ou via :
--   cd frontend && npm run db:reset-intel

BEGIN;

-- ── 1. Données dérivées du pipeline intel ───────────────────────────────────
DELETE FROM "CardCatalogBenefit";
DELETE FROM "CatalogCardImageBlob";
DELETE FROM "CatalogDocumentBlob";
DELETE FROM "RewardRule";
DELETE FROM "CardIntelJob";
DELETE FROM "CardCatalogExtractProposal";

-- ── 2. Produits catalogue hors liste statique (adhoc-*, essais intel) ───────
--    Les CreditCard liées gardent leur slug mais catalogProductSlug → NULL (ON DELETE SET NULL).
DELETE FROM "CardCatalogProduct"
WHERE "slug" NOT IN (
  'chase-sapphire-preferred',
  'chase-sapphire-reserve',
  'chase-freedom-unlimited',
  'chase-freedom-flex',
  'chase-amazon-prime-visa',
  'amex-gold',
  'amex-platinum',
  'amex-blue-cash-preferred',
  'amex-blue-cash-everyday',
  'amex-green',
  'citi-double-cash',
  'citi-custom-cash',
  'citi-premier',
  'capital-one-venture',
  'capital-one-venture-x',
  'capital-one-quicksilver',
  'capital-one-savor',
  'capital-one-savorone',
  'discover-it',
  'discover-it-miles',
  'wells-fargo-active-cash',
  'wells-fargo-autograph',
  'boa-customized-cash',
  'boa-unlimited-cash',
  'usbank-altitude-go',
  'usbank-cash-plus',
  'barclays-arrival-plus',
  'apple-card',
  'paypal-cashback-mastercard',
  'bilt-mastercard',
  'costco-anywhere',
  'amazon-store-card'
);

-- ── 3. Remise à zéro des snapshots intel sur le catalogue canonique ─────────
UPDATE "CardCatalogProduct"
SET
  "lastExtractHash" = NULL,
  "lastExtractJson" = NULL,
  "lastFetchedAt" = NULL,
  "editorialSupplementUrls" = NULL,
  "officialDocumentUrl" = NULL;

-- KnownIssuer : non modifié (issuers whitelisted / appris en DB)

COMMIT;

-- Vérification rapide (optionnel) :
-- SELECT COUNT(*) AS intel_jobs FROM "CardIntelJob";
-- SELECT COUNT(*) AS reward_rules FROM "RewardRule";
-- SELECT slug, "lastExtractHash" IS NOT NULL AS has_extract FROM "CardCatalogProduct" ORDER BY slug;
