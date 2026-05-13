-- Learned issuers from successful PDF intel (display + apex for scoped search)
CREATE TABLE "KnownIssuer" (
    "apexDomain" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnownIssuer_pkey" PRIMARY KEY ("apexDomain")
);

CREATE INDEX "KnownIssuer_displayName_idx" ON "KnownIssuer"("displayName");
