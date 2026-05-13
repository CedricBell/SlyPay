import { EarningType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapExtractToRewardRules } from "@/server/card-intelligence/map-extract-to-reward-rules";
import { rewardsExtractSchema } from "@/server/card-intelligence/rewards-extract-schema";
import {
  sanitizeRewardRuleDrafts,
  type RewardRuleDraft,
} from "@/server/reward-rules-sanitize";

/** Replace rules on every user card linked to this catalog slug (within `tx`). */
export async function replaceLinkedCardRewardRulesForCatalogSlug(
  tx: Prisma.TransactionClient,
  productSlug: string,
  sanitized: RewardRuleDraft[],
): Promise<number> {
  const cards = await tx.creditCard.findMany({
    where: { catalogProductSlug: productSlug },
    select: { id: true },
  });
  for (const c of cards) {
    await tx.rewardRule.deleteMany({ where: { creditCardId: c.id } });
    if (sanitized.length) {
      await tx.rewardRule.createMany({
        data: sanitized.map((r, i) => ({
          creditCardId: c.id,
          category: r.category,
          multiplier: r.multiplier,
          earningType: r.earningType ?? EarningType.POINTS,
          capAmountMonthly: r.capAmountMonthly ?? null,
          priority: r.priority ?? i,
          notes: r.notes ?? null,
        })),
      });
    }
  }
  return cards.length;
}

export async function applyCatalogExtractProposal(proposalId: string): Promise<{
  productSlug: string;
  linkedCardsUpdated: number;
  rulesPerCard: number;
}> {
  const proposal = await prisma.cardCatalogExtractProposal.findUnique({
    where: { id: proposalId },
    include: { product: true },
  });

  if (!proposal) {
    throw new Error("Proposition introuvable");
  }
  if (proposal.status !== "PENDING") {
    throw new Error("Cette proposition n'est plus en attente");
  }

  const extract = rewardsExtractSchema.parse(proposal.proposedPayload);

  const drafts = await mapExtractToRewardRules({
    productName: proposal.product.name,
    issuer: proposal.product.issuer,
    extract,
  });
  const sanitized = sanitizeRewardRuleDrafts(drafts);

  const result = await prisma.$transaction(async (tx) => {
    await tx.cardCatalogProduct.update({
      where: { slug: proposal.productSlug },
      data: {
        lastExtractHash: proposal.proposedHash,
        lastExtractJson: proposal.proposedPayload as object,
        lastFetchedAt: new Date(),
      },
    });

    await tx.cardCatalogExtractProposal.update({
      where: { id: proposalId },
      data: { status: "APPLIED" },
    });

    await tx.cardCatalogExtractProposal.updateMany({
      where: {
        productSlug: proposal.productSlug,
        status: "PENDING",
        id: { not: proposalId },
      },
      data: { status: "DISMISSED" },
    });

    const linked = await replaceLinkedCardRewardRulesForCatalogSlug(
      tx,
      proposal.productSlug,
      sanitized,
    );

    return {
      productSlug: proposal.productSlug,
      linkedCardsUpdated: linked,
      rulesPerCard: sanitized.length,
    };
  });

  return result;
}

export async function dismissCatalogExtractProposal(proposalId: string) {
  const proposal = await prisma.cardCatalogExtractProposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) throw new Error("Proposition introuvable");
  if (proposal.status !== "PENDING") {
    throw new Error("Cette proposition n'est plus en attente");
  }
  await prisma.cardCatalogExtractProposal.update({
    where: { id: proposalId },
    data: { status: "DISMISSED" },
  });
}
