-- Reset COMPLET : pipeline intel + tous les wallets utilisateur.
-- Conserve :
--   • User (comptes Supabase / app)
--   • KnownIssuer (issuers appris en DB)
--   • ISSUER_SAFELIST (code — issuer-safelist.ts)
--   • CardCatalogProduct statique (31 slugs) — champs intel remis à zéro
--   • Merchant, Transaction, Recommendation (historique), RecommendationFeedback
--
-- Supprime :
--   • Toutes les CreditCard + Offer
--   • Jobs intel, règles, benefits, PDF uploadés, propositions
--   • Produits catalogue ad-hoc

BEGIN;

-- ── 1. Pipeline intel ───────────────────────────────────────────────────────
DELETE FROM "CardCatalogBenefit";
DELETE FROM "CatalogDocumentBlob";
DELETE FROM "RewardRule";
DELETE FROM "CardIntelJob";
DELETE FROM "CardCatalogExtractProposal";

-- ── 2. Wallets utilisateur ──────────────────────────────────────────────────
UPDATE "Recommendation" SET "bestCardId" = NULL WHERE "bestCardId" IS NOT NULL;
DELETE FROM "Offer";
DELETE FROM "CreditCard";

-- ── 3. Catalogue hors liste statique ────────────────────────────────────────
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

-- ── 4. Snapshots intel remis à zéro sur le catalogue canonique ──────────────
UPDATE "CardCatalogProduct"
SET
  "lastExtractHash" = NULL,
  "lastExtractJson" = NULL,
  "lastFetchedAt" = NULL,
  "editorialSupplementUrls" = NULL,
  "officialDocumentUrl" = NULL;

COMMIT;
