import type {
  CardCatalogProduct,
  CardIntelJobStatus,
  CreditCard,
  Offer,
  RewardRule,
} from "@prisma/client";
import { dec } from "@/lib/serialize";
import { rewardRulesForWalletCard } from "@/lib/credit-card-rules";
import { computeWalletScore } from "@/lib/wallet-score";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";

export type CardWithRules = CreditCard & {
  offers: Offer[];
};

export type CardWithRulesAndCatalog = CardWithRules & {
  catalogProduct?: (Pick<
    CardCatalogProduct,
    | "slug"
    | "name"
    | "issuer"
    | "lastExtractJson"
    | "lastExtractHash"
    | "officialDocumentUrl"
    | "rotatingBonusCalendar"
    | "imageUrl"
  > & { rewardRules?: RewardRule[]; benefits?: Array<{
    kind: string;
    title: string;
    description: string | null;
    amountText: string | null;
    coverageSummary: string | null;
  }> }) | null;
  intelJobs?: Array<{
    status: CardIntelJobStatus;
    errorMessage: string | null;
    startedAt: Date | null;
    createdAt: Date;
  }>;
};

export type MappedIntelJob = {
  status: CardIntelJobStatus;
  errorMessage: string | null;
  startedAt: string | null;
  createdAt: string;
};

function summarizeExtract(json: unknown): {
  summaryLine: string | null;
  creditLabels: string[];
  protectionLabels: string[];
  benefitsSummary: string | null;
} {
  if (!json || typeof json !== "object") {
    return {
      summaryLine: null,
      creditLabels: [],
      protectionLabels: [],
      benefitsSummary: null,
    };
  }
  const o = json as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary : null;
  const benefitsSummary =
    typeof o.benefitsSummary === "string" ? o.benefitsSummary : null;
  const sc = o.statementCredits;
  const labels: string[] = [];
  if (Array.isArray(sc)) {
    for (const item of sc.slice(0, 8)) {
      if (item && typeof item === "object") {
        const row = item as {
          description?: string;
          amountText?: string;
          cadence?: string;
        };
        const parts = [row.description, row.amountText, row.cadence].filter(Boolean);
        if (parts.length) labels.push(parts.join(" · ").slice(0, 120));
      }
    }
  }
  const protectionLabels: string[] = [];
  const prot = o.protections;
  if (Array.isArray(prot)) {
    for (const item of prot.slice(0, 4)) {
      if (item && typeof item === "object" && "title" in item) {
        const t = (item as { title?: string; coverageSummary?: string }).title;
        const c = (item as { coverageSummary?: string }).coverageSummary;
        if (t) protectionLabels.push(`${t}${c ? `: ${c.slice(0, 60)}` : ""}`);
      }
    }
  }
  return {
    summaryLine: summary ? summary.slice(0, 320) : null,
    creditLabels: labels,
    protectionLabels,
    benefitsSummary: benefitsSummary ? benefitsSummary.slice(0, 280) : null,
  };
}

function rulesStrengthLines(rules: RewardRule[]): string[] {
  const sorted = [...rules].sort(
    (a, b) => Number(b.multiplier) - Number(a.multiplier),
  );
  return sorted.slice(0, 4).map(
    (r) => `${dec(r.multiplier)}× ${r.category} (${r.earningType})`,
  );
}

export function mapCreditCardJson(c: CardWithRulesAndCatalog) {
  const { catalogProduct, ...rest } = c;
  const rewardRules = rewardRulesForWalletCard(c);
  const linked = Boolean(rest.catalogProductSlug && catalogProduct);
  const { summaryLine, creditLabels, protectionLabels, benefitsSummary } =
    summarizeExtract(catalogProduct?.lastExtractJson ?? null);
  const hasExtract = Boolean(catalogProduct?.lastExtractJson);
  const extractJson = hasExtract ? catalogProduct?.lastExtractJson : null;
  const rotatingCal =
    catalogProduct?.rotatingBonusCalendar ??
    CARD_CATALOG_ENTRIES.find((e) => e.id === rest.catalogProductSlug)
      ?.rotatingBonusCalendar ??
    null;
  const {
    total: walletScore,
    breakdown: walletScoreBreakdown,
  } = computeWalletScore(rewardRules, extractJson, {
    cardId: rest.id,
    cardName: rest.name,
    issuer: rest.issuer,
    offers: c.offers,
    rotatingBonusCalendar: rotatingCal,
  });

  const latestIntelJob = c.intelJobs?.[0] ?? null;
  const intelActive =
    latestIntelJob != null &&
    (latestIntelJob.status === "PENDING" ||
      latestIntelJob.status === "RUNNING");
  const hasRules = rewardRules.length > 0;
  const walletScoreAnalyzing =
    !hasRules && linked && (intelActive || latestIntelJob == null);

  const intelJob: MappedIntelJob | null = latestIntelJob
    ? {
        status: latestIntelJob.status,
        errorMessage: latestIntelJob.errorMessage,
        startedAt: latestIntelJob.startedAt?.toISOString() ?? null,
        createdAt: latestIntelJob.createdAt.toISOString(),
      }
    : null;

  return {
    ...rest,
    rewardRules: rewardRules.map((r) => ({
      ...r,
      multiplier: dec(r.multiplier),
      capAmountMonthly:
        r.capAmountMonthly != null ? dec(r.capAmountMonthly) : null,
      excludedMerchants: r.excludedMerchants ?? [],
    })),
    offers: c.offers.map((o) => ({
      ...o,
      multiplier: dec(o.multiplier),
    })),
    catalogLinked: linked,
    catalogSlug: catalogProduct?.slug ?? rest.catalogProductSlug ?? null,
    hasOfficialPdfExtract: hasExtract,
    officialDocumentUrl: catalogProduct?.officialDocumentUrl ?? null,
    rotatingBonusCalendar: rotatingCal,
    walletScore,
    walletScoreAnalyzing,
    intelJob,
    walletPreview: {
      ruleHighlights: rulesStrengthLines(rewardRules),
      pdfSummary: summaryLine,
      benefitsSummary,
      statementCreditHints: creditLabels,
      protectionHints: protectionLabels,
      scoreBreakdown: walletScoreBreakdown,
    },
    catalogImageUrl: catalogProduct?.imageUrl ?? null,
  };
}
