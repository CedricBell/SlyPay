import type {
  CardCatalogProduct,
  CardIntelJobStatus,
  CreditCard,
  Offer,
  RewardRule,
} from "@prisma/client";
import { dec } from "@/lib/serialize";
import { rewardRulesForWalletCard } from "@/lib/credit-card-rules";
import {
  buildRotatingQuarterPreviews,
  walletEarnHighlights,
} from "@/lib/rotating-rewards";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import {
  formatStatementCreditLineFromDisplay,
  statementCreditsFromExtractJson,
  toStatementCreditDisplay,
  type StatementCreditDisplay,
} from "@/lib/statement-credit-display";
import { catalogImageSrcForDisplay } from "@/lib/catalog-image-display";
import {
  resolveCatalogImageUrl,
  resolveCatalogImageUrlByIssuerAndName,
} from "@/server/catalog-card-art";
import { formatPerkHint, formatProtectionHint } from "@/lib/truncate-display-text";

export type WalletPerkPreview = {
  title: string;
  description: string;
  categoryHint: string | null;
  hint: string;
};

export function walletPerkKey(perk: WalletPerkPreview, index: number): string {
  return `${index}-${perk.title}-${perk.hint}-${perk.description.slice(0, 48)}`;
}

function isPlaceholderPerk(title: string, description: string): boolean {
  return (
    title.trim().toLowerCase() === "perk" &&
    description.trim().toLowerCase() === "perk"
  );
}

function dedupePerkPreviews(items: WalletPerkPreview[]): WalletPerkPreview[] {
  const seen = new Set<string>();
  const out: WalletPerkPreview[] = [];
  for (const p of items) {
    if (isPlaceholderPerk(p.title, p.description)) continue;
    const k = `${p.title}\0${p.description}\0${p.hint}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

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
      limitsText: string | null;
      enrollmentRequired?: boolean;
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
        annualCapText: b.limitsText,
        merchantHint: b.merchantHint,
        notes: b.description,
        enrollmentRequired: b.enrollmentRequired,
      }),
    );
}

function protectionsFromCatalogBenefits(
  benefits: CatalogBenefitRow[] | undefined,
): string[] {
  if (!benefits?.length) return [];
  return benefits
    .filter((b) => b.kind === "PROTECTION")
    .slice(0, 24)
    .map((b) =>
      formatProtectionHint(b.title, b.coverageSummary ?? b.description ?? ""),
    );
}

function perksFromCatalogBenefits(
  benefits: CatalogBenefitRow[] | undefined,
): WalletPerkPreview[] {
  if (!benefits?.length) return [];
  return dedupePerkPreviews(
    benefits
      .filter((b) => b.kind === "PERK")
      .slice(0, 24)
      .map((b) => {
        const title = b.title.trim();
        const description = (b.description ?? b.title).trim();
        return {
          title,
          description,
          categoryHint: null,
          hint: formatPerkHint(title, description),
        };
      }),
  );
}

function protectionsFromExtractJson(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const prot = (json as { protections?: unknown }).protections;
  if (!Array.isArray(prot)) return [];
  const labels: string[] = [];
  for (const item of prot.slice(0, 24)) {
    if (!item || typeof item !== "object" || !("title" in item)) continue;
    const t = (item as { title?: string; coverageSummary?: string }).title;
    const c = (item as { coverageSummary?: string }).coverageSummary;
    if (t) labels.push(formatProtectionHint(t, c ?? ""));
  }
  return labels;
}

function perksFromExtractJson(json: unknown): WalletPerkPreview[] {
  if (!json || typeof json !== "object") return [];
  const rows = (json as { perks?: unknown }).perks;
  if (!Array.isArray(rows)) return [];
  const out: WalletPerkPreview[] = [];
  for (const item of rows.slice(0, 24)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? row.name ?? "").trim();
    if (!title) continue;
    const description = String(
      row.description ?? row.summary ?? row.text ?? title,
    ).trim();
    const categoryHint =
      row.categoryHint != null
        ? String(row.categoryHint)
        : row.category != null
          ? String(row.category)
          : null;
    out.push({
      title,
      description,
      categoryHint,
      hint: formatPerkHint(title, description),
    });
  }
  return dedupePerkPreviews(out);
}

function summarizeExtract(
  json: unknown,
  catalogBenefits?: CatalogBenefitRow[],
): {
  summaryLine: string | null;
  creditLabels: string[];
  statementCredits: StatementCreditDisplay[];
  protectionLabels: string[];
  perkHints: WalletPerkPreview[];
  benefitsSummary: string | null;
} {
  const catalogCredits = statementCreditsFromCatalogBenefits(catalogBenefits);
  const catalogProtections = protectionsFromCatalogBenefits(catalogBenefits);
  const catalogPerks = perksFromCatalogBenefits(catalogBenefits);

  if (!json || typeof json !== "object") {
    const creditLabels = catalogCredits.map((d) =>
      formatStatementCreditLineFromDisplay(d),
    );
    return {
      summaryLine: null,
      creditLabels,
      statementCredits: catalogCredits,
      protectionLabels: catalogProtections,
      perkHints: catalogPerks,
      benefitsSummary: null,
    };
  }
  const o = json as Record<string, unknown>;
  const benefitsSummary =
    typeof o.benefitsSummary === "string" ? o.benefitsSummary : null;
  const fromExtract = statementCreditsFromExtractJson(json, 12);
  const statementCredits =
    catalogCredits.length > 0 ? catalogCredits : fromExtract;
  const creditLabels = statementCredits.map((d) =>
    formatStatementCreditLineFromDisplay(d),
  );
  const extractProtections = protectionsFromExtractJson(json);
  const extractPerks = perksFromExtractJson(json);
  const protectionLabels =
    catalogProtections.length > 0 ? catalogProtections : extractProtections;
  const perkHints = catalogPerks.length > 0 ? catalogPerks : extractPerks;

  return {
    summaryLine: null,
    creditLabels,
    statementCredits,
    protectionLabels,
    perkHints,
    benefitsSummary,
  };
}

function rulesStrengthLines(
  rules: RewardRule[],
  rotatingCal: unknown,
): string[] {
  if (rotatingCal) {
    return walletEarnHighlights(rules, rotatingCal);
  }
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
    perkHints,
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
  const INTEL_BOOTSTRAP_MS = 2 * 60_000;
  const createdAtMs = rest.createdAt ? new Date(rest.createdAt).getTime() : 0;
  const awaitingIntelJob =
    latestIntelJob == null &&
    createdAtMs > 0 &&
    Date.now() - createdAtMs < INTEL_BOOTSTRAP_MS;
  const walletScoreAnalyzing =
    !hasRules && linked && (intelActive || awaitingIntelJob);

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
      ruleHighlights: rulesStrengthLines(rewardRules, rotatingCal),
      pdfSummary: summaryLine,
      benefitsSummary,
      statementCreditHints: creditLabels,
      statementCredits,
      protectionHints: protectionLabels,
      perkHints,
      rotatingQuarters: rotatingCal
        ? buildRotatingQuarterPreviews(rotatingCal)
        : undefined,
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
