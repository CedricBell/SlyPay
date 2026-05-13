import type {
  CardCatalogProduct,
  CreditCard,
  Offer,
  RewardRule,
} from "@prisma/client";
import { dec } from "@/lib/serialize";
import { computeWalletScore } from "@/lib/wallet-score";

export type CardWithRules = CreditCard & {
  rewardRules: RewardRule[];
  offers: Offer[];
};

export type CardWithRulesAndCatalog = CardWithRules & {
  catalogProduct?: Pick<
    CardCatalogProduct,
    | "slug"
    | "lastExtractJson"
    | "lastExtractHash"
    | "officialDocumentUrl"
  > | null;
};

function summarizeExtract(json: unknown): {
  summaryLine: string | null;
  creditLabels: string[];
} {
  if (!json || typeof json !== "object") {
    return { summaryLine: null, creditLabels: [] };
  }
  const o = json as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary : null;
  const sc = o.statementCredits;
  const labels: string[] = [];
  if (Array.isArray(sc)) {
    for (const item of sc.slice(0, 6)) {
      if (item && typeof item === "object" && "description" in item) {
        const d = (item as { description?: string }).description;
        if (d) labels.push(d.slice(0, 100));
      }
    }
  }
  return {
    summaryLine: summary ? summary.slice(0, 280) : null,
    creditLabels: labels,
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
  const linked = Boolean(rest.catalogProductSlug && catalogProduct);
  const { summaryLine, creditLabels } = summarizeExtract(
    catalogProduct?.lastExtractJson ?? null,
  );
  const hasExtract = Boolean(catalogProduct?.lastExtractJson);
  const extractJson = hasExtract ? catalogProduct?.lastExtractJson : null;
  const { total: walletScore, breakdown: walletScoreBreakdown } =
    computeWalletScore(c.rewardRules, extractJson);

  return {
    ...rest,
    rewardRules: c.rewardRules.map((r) => ({
      ...r,
      multiplier: dec(r.multiplier),
      capAmountMonthly:
        r.capAmountMonthly != null ? dec(r.capAmountMonthly) : null,
    })),
    offers: c.offers.map((o) => ({
      ...o,
      multiplier: dec(o.multiplier),
    })),
    catalogLinked: linked,
    catalogSlug: catalogProduct?.slug ?? rest.catalogProductSlug ?? null,
    hasOfficialPdfExtract: hasExtract,
    officialDocumentUrl: catalogProduct?.officialDocumentUrl ?? null,
    walletScore,
    walletPreview: {
      ruleHighlights: rulesStrengthLines(c.rewardRules),
      pdfSummary: summaryLine,
      statementCreditHints: creditLabels,
      scoreBreakdown: walletScoreBreakdown,
    },
  };
}
