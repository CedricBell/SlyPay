import type { RewardRule } from "@prisma/client";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { sanitizeRewardRulesForRotatingCalendar } from "@/lib/rotating-rewards";

export type CatalogProductWithRules = {
  rewardRules?: RewardRule[];
  rotatingBonusCalendar?: unknown;
  slug?: string;
} | null;

function rotatingCalendarForCard(card: {
  catalogProduct?: CatalogProductWithRules;
  catalogProductSlug?: string | null;
}): unknown {
  return (
    card.catalogProduct?.rotatingBonusCalendar ??
    CARD_CATALOG_ENTRIES.find(
      (e) =>
        e.id ===
        (card.catalogProduct?.slug ?? card.catalogProductSlug ?? ""),
    )?.rotatingBonusCalendar ??
    null
  );
}

/** Reward rules live on the catalog product; wallet cards inherit via slug link. */
export function rewardRulesForWalletCard(card: {
  catalogProduct?: CatalogProductWithRules;
  catalogProductSlug?: string | null;
}): RewardRule[] {
  const raw = card.catalogProduct?.rewardRules ?? [];
  return sanitizeRewardRulesForRotatingCalendar(
    raw,
    rotatingCalendarForCard(card),
  );
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
      benefits: {
        orderBy: [{ priority: "asc" as const }],
      },
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
