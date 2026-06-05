-- CreateEnum
CREATE TYPE "CardWalletContributionStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "CardWalletContribution" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CardWalletContributionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "CardWalletContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardWalletContribution_creditCardId_status_idx" ON "CardWalletContribution"("creditCardId", "status");

-- CreateIndex
CREATE INDEX "CardWalletContribution_userId_idx" ON "CardWalletContribution"("userId");

-- AddForeignKey
ALTER TABLE "CardWalletContribution" ADD CONSTRAINT "CardWalletContribution_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardWalletContribution" ADD CONSTRAINT "CardWalletContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
