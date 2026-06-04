import type { RewardRule } from "@prisma/client";

export type CatalogProductWithRules = {
  rewardRules?: RewardRule[];
} | null;

/** Reward rules live on the catalog product; wallet cards inherit via slug link. */
export function rewardRulesForWalletCard(card: {
  catalogProduct?: CatalogProductWithRules;
}): RewardRule[] {
  return card.catalogProduct?.rewardRules ?? [];
}

/** Lighter include for wallet list (skips large extract JSON blobs). */
export const walletCardListInclude = {
  offers: true,
  catalogProduct: {
    select: {
      slug: true,
      name: true,
      issuer: true,
      lastExtractHash: true,
      officialDocumentUrl: true,
      rotatingBonusCalendar: true,
      rewardRules: {
        orderBy: [{ priority: "asc" as const }, { multiplier: "desc" as const }],
      },
      imageUrl: true,
    },
  },
  intelJobs: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      status: true,
      errorMessage: true,
      startedAt: true,
      createdAt: true,
    },
  },
};

export const walletCardInclude = {
  offers: true,
  catalogProduct: {
    select: {
      slug: true,
      name: true,
      issuer: true,
      lastExtractJson: true,
      lastExtractHash: true,
      officialDocumentUrl: true,
      rotatingBonusCalendar: true,
      rewardRules: {
        orderBy: [{ priority: "asc" as const }, { multiplier: "desc" as const }],
      },
      benefits: {
        orderBy: [{ priority: "asc" as const }],
      },
      imageUrl: true,
    },
  },
  intelJobs: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      status: true,
      errorMessage: true,
      startedAt: true,
      createdAt: true,
    },
  },
};

export const catalogProductAdminInclude = {
  rewardRules: {
    orderBy: [{ priority: "asc" as const }, { multiplier: "desc" as const }],
  },
  _count: { select: { creditCards: true } },
  uploadedDocument: {
    select: {
      byteSize: true,
      fileName: true,
      uploadedAt: true,
    },
  },
  intelJobs: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      status: true,
      createdAt: true,
      finishedAt: true,
      errorMessage: true,
    },
  },
};
