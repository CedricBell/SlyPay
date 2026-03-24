-- CreateEnum
CREATE TYPE "SpendCategory" AS ENUM ('GROCERIES', 'DINING', 'TRAVEL', 'GAS', 'ONLINE_SHOPPING', 'DRUGSTORES', 'ENTERTAINMENT', 'WHOLESALE', 'OTHER');

-- CreateEnum
CREATE TYPE "EarningType" AS ENUM ('CASHBACK_PERCENT', 'POINTS', 'MILES');

-- CreateEnum
CREATE TYPE "OfferStackPolicy" AS ENUM ('REPLACE_BASE', 'ADDITIVE');

-- CreateEnum
CREATE TYPE "MappingSource" AS ENUM ('MCC', 'MANUAL', 'USER_REPORTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "last4" TEXT,
    "colorHex" TEXT DEFAULT '#0f172a',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "category" "SpendCategory" NOT NULL,
    "multiplier" DECIMAL(6,3) NOT NULL,
    "earningType" "EarningType" NOT NULL DEFAULT 'POINTS',
    "capAmountMonthly" DECIMAL(12,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "SpendCategory",
    "multiplier" DECIMAL(6,3) NOT NULL,
    "stackPolicy" "OfferStackPolicy" NOT NULL DEFAULT 'REPLACE_BASE',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "mcc" VARCHAR(4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantCategoryMapping" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "category" "SpendCategory" NOT NULL,
    "source" "MappingSource" NOT NULL DEFAULT 'MANUAL',
    "confidence" DECIMAL(4,3) NOT NULL DEFAULT 1.0,

    CONSTRAINT "MerchantCategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MccCategoryMap" (
    "mcc" VARCHAR(4) NOT NULL,
    "category" "SpendCategory" NOT NULL,
    "label" TEXT,

    CONSTRAINT "MccCategoryMap_pkey" PRIMARY KEY ("mcc")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "category" "SpendCategory",
    "mcc" VARCHAR(4),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "resolvedCategory" "SpendCategory" NOT NULL,
    "merchantName" TEXT,
    "mcc" VARCHAR(4),
    "bestCardId" TEXT,
    "explanation" JSONB NOT NULL,
    "alternates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "CreditCard_userId_isActive_idx" ON "CreditCard"("userId", "isActive");

-- CreateIndex
CREATE INDEX "RewardRule_creditCardId_category_idx" ON "RewardRule"("creditCardId", "category");

-- CreateIndex
CREATE INDEX "Offer_creditCardId_idx" ON "Offer"("creditCardId");

-- CreateIndex
CREATE INDEX "Offer_validFrom_validUntil_idx" ON "Offer"("validFrom", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_slug_key" ON "Merchant"("slug");

-- CreateIndex
CREATE INDEX "Merchant_normalized_idx" ON "Merchant"("normalized");

-- CreateIndex
CREATE INDEX "Merchant_mcc_idx" ON "Merchant"("mcc");

-- CreateIndex
CREATE INDEX "MerchantCategoryMapping_merchantId_idx" ON "MerchantCategoryMapping"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCategoryMapping_merchantId_category_key" ON "MerchantCategoryMapping"("merchantId", "category");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_userId_createdAt_idx" ON "Recommendation"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantCategoryMapping" ADD CONSTRAINT "MerchantCategoryMapping_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
