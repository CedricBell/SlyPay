import { CardBenefitKind, type Prisma, SpendCategory } from "@prisma/client";
import type { RewardsExtract } from "@/server/card-intelligence/rewards-extract-schema";
import { spendCategoryFromHint } from "@/server/card-intelligence/rewards-extract-schema";
import { resolveStatementCreditTitle } from "@/lib/statement-credit-display";

export async function applyBenefitsFromExtract(
  tx: Prisma.TransactionClient,
  catalogProductSlug: string,
  extract: RewardsExtract,
): Promise<number> {
  await tx.cardCatalogBenefit.deleteMany({ where: { catalogProductSlug } });

  const rows: Prisma.CardCatalogBenefitCreateManyInput[] = [];
  let priority = 0;

  for (const sc of extract.statementCredits) {
    const title = resolveStatementCreditTitle(sc);
    rows.push({
      catalogProductSlug,
      kind: CardBenefitKind.STATEMENT_CREDIT,
      title,
      description:
        sc.merchantHint?.trim() ||
        sc.categoryHint?.trim() ||
        sc.description.trim() !== title
          ? sc.description.trim()
          : null,
      amountText: sc.amountText?.trim() ?? null,
      cadence: sc.cadence?.trim() ?? null,
      merchantHint: sc.merchantHint?.trim() ?? null,
      category: spendCategoryFromHint(sc.categoryHint),
      enrollmentRequired: sc.enrollmentRequired ?? false,
      priority: priority++,
    });
  }

  for (const p of extract.protections ?? []) {
    rows.push({
      catalogProductSlug,
      kind: CardBenefitKind.PROTECTION,
      title: p.title.trim(),
      description: p.coverageSummary.trim(),
      coverageSummary: p.coverageSummary.trim(),
      limitsText: p.limitsText?.trim() ?? null,
      priority: priority++,
    });
  }

  for (const perk of extract.perks ?? []) {
    rows.push({
      catalogProductSlug,
      kind: CardBenefitKind.PERK,
      title: perk.title.trim(),
      description: perk.description.trim(),
      category: spendCategoryFromHint(perk.categoryHint),
      priority: priority++,
    });
  }

  if (extract.welcomeOffer?.description?.trim()) {
    const wo = extract.welcomeOffer;
    rows.push({
      catalogProductSlug,
      kind: CardBenefitKind.WELCOME_OFFER,
      title: "Welcome offer",
      description: wo.description.trim(),
      amountText: wo.amountText?.trim() ?? null,
      cadence: wo.timeframe?.trim() ?? null,
      limitsText: wo.spendRequirement?.trim() ?? null,
      priority: priority++,
    });
  }

  if (extract.loyaltyProgramNotes?.trim()) {
    rows.push({
      catalogProductSlug,
      kind: CardBenefitKind.LOYALTY,
      title: "Loyalty program",
      description: extract.loyaltyProgramNotes.trim(),
      priority: priority++,
    });
  }

  if (rows.length === 0) return 0;
  await tx.cardCatalogBenefit.createMany({ data: rows });
  return rows.length;
}
