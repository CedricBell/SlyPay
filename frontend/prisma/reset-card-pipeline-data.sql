-- Reset cartes utilisateur, règles, offres, jobs d’intel et catalogue issu du pipeline.
-- À exécuter dans l’éditeur SQL Supabase (ou psql) sur la base du projet.
-- Ne supprime pas les utilisateurs, marchands, transactions, ni les merchants seed.

BEGIN;

DELETE FROM "RewardRule";
DELETE FROM "Offer";
DELETE FROM "CardIntelJob";
DELETE FROM "CardCatalogExtractProposal";
DELETE FROM "CreditCard";
DELETE FROM "CardCatalogProduct";

UPDATE "Recommendation" SET "bestCardId" = NULL WHERE "bestCardId" IS NOT NULL;

COMMIT;
