import type {
  CardCatalogProduct,
  CardIntelJobStatus,
  CreditCard,
  Offer,
  RewardRule,
} from "@prisma/client";
import { dec } from "@/lib/serialize";
import { rewardRulesForWalletCard } from "@/lib/credit-card-rules";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import {
  statementCreditsFromExtractJson,
  toStatementCreditDisplay,
  type StatementCreditDisplay,
} from "@/lib/statement-credit-display";
import { catalogImageSrcForDisplay } from "@/lib/catalog-image-display";
import {
  resolveCatalogImageUrl,
  resolveCatalogImageUrlByIssuerAndName,
} from "@/server/catalog-card-art";
import { formatProtectionHint } from "@/lib/truncate-display-text";

export type CardWithRules = CreditCard & {
  offers: Offer[];
};

export type CardWithRulesAndCatalog = CardWithRules & {
  catalogProduct?: (Pick<
    CardCatalogProduct,
    | "slug"
    | "name"
    | "issuer"
    | "lastExtractHash"
    | "officialDocumentUrl"
    | "rotatingBonusCalendar"
    | "imageUrl"
  > & {
    lastExtractJson?: CardCatalogProduct["lastExtractJson"];
    rewardRules?: RewardRule[];
    benefits?: Array<{
      kind: string;
      title: string;
      description: string | null;
      amountText: string | null;
      cadence: string | null;
      merchantHint: string | null;
      coverageSummary: string | null;
    }>;
  }) | null;
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

type CatalogBenefitRow = NonNullable<
  CardWithRulesAndCatalog["catalogProduct"]
>["benefits"] extends infer B
  ? B extends Array<infer R>
    ? R
    : never
  : never;

function statementCreditsFromCatalogBenefits(
  benefits: CatalogBenefitRow[] | undefined,
): StatementCreditDisplay[] {
  if (!benefits?.length) return [];
  return benefits
    .filter((b) => b.kind === "STATEMENT_CREDIT")
    .slice(0, 12)
    .map((b) =>
      toStatementCreditDisplay({
        description: b.title,
        amountText: b.amountText,
        cadence: b.cadence,
        merchantHint: b.merchantHint,
      }),
    );
}

function summarizeExtract(
  json: unknown,
  catalogBenefits?: CatalogBenefitRow[],
): {
  summaryLine: string | null;
  creditLabels: string[];
  statementCredits: StatementCreditDisplay[];
  protectionLabels: string[];
  benefitsSummary: string | null;
} {
  const fromBenefits = statementCreditsFromCatalogBenefits(catalogBenefits);

  if (!json || typeof json !== "object") {
    const creditLabels = fromBenefits.map((d) => {
      const parts = [d.title, d.amountText, d.cadence].filter(Boolean);
      return parts.join(" · ");
    });
    return {
      summaryLine: null,
      creditLabels,
      statementCredits: fromBenefits,
      protectionLabels: [],
      benefitsSummary: null,
    };
  }
  const o = json as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary : null;
  const benefitsSummary =
    typeof o.benefitsSummary === "string" ? o.benefitsSummary : null;
  const fromExtract = statementCreditsFromExtractJson(json, 12);
  const statementCredits =
    fromBenefits.length > 0 ? fromBenefits : fromExtract;
  const creditLabels = statementCredits.map((d) => {
    const parts = [d.title, d.amountText, d.cadence].filter(Boolean);
    return parts.join(" · ").slice(0, 200);
  });
  const protectionLabels: string[] = [];
  const prot = o.protections;
  if (Array.isArray(prot)) {
    for (const item of prot.slice(0, 24)) {
      if (item && typeof item === "object" && "title" in item) {
        const t = (item as { title?: string; coverageSummary?: string }).title;
        const c = (item as { coverageSummary?: string }).coverageSummary;
        if (t) {
          protectionLabels.push(formatProtectionHint(t, c ?? ""));
        }
      }
    }
  }
  return {
    summaryLine: null,
    creditLabels,
    statementCredits,
    protectionLabels,
    benefitsSummary: null,
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
  const extractJson = catalogProduct?.lastExtractJson ?? null;
  const hasExtract = Boolean(
    extractJson ?? catalogProduct?.lastExtractHash,
  );
  const {
    summaryLine,
    creditLabels,
    statementCredits,
    protectionLabels,
    benefitsSummary,
  } = summarizeExtract(extractJson, catalogProduct?.benefits);
  const rotatingCal =
    catalogProduct?.rotatingBonusCalendar ??
    CARD_CATALOG_ENTRIES.find((e) => e.id === rest.catalogProductSlug)
      ?.rotatingBonusCalendar ??
    null;
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
    walletScoreAnalyzing,
    intelJob,
    walletPreview: {
      ruleHighlights: rulesStrengthLines(rewardRules),
      pdfSummary: summaryLine,
      benefitsSummary,
      statementCreditHints: creditLabels,
      statementCredits,
      protectionHints: protectionLabels,
    },
    catalogImageUrl:
      catalogImageSrcForDisplay(
        resolveCatalogImageUrl(
          catalogProduct?.slug ?? rest.catalogProductSlug ?? "",
          { imageUrl: catalogProduct?.imageUrl },
        ) ??
          resolveCatalogImageUrlByIssuerAndName(rest.issuer, rest.name) ??
          null,
      ),
  };
}
