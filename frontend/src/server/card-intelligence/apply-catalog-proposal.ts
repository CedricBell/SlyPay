import { EarningType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapExtractToRewardRules } from "@/server/card-intelligence/map-extract-to-reward-rules";
import { applyExtractSnapshotToCatalog, applyRewardRulesToCatalogProduct } from "@/server/catalog-reward-rules";
import { parseRewardsExtract } from "@/server/card-intelligence/rewards-extract-schema";
import {
  sanitizeRewardRuleDrafts,
  type RewardRuleDraft,
} from "@/server/reward-rules-sanitize";

/** Replace canonical reward rules on a catalog product (within `tx`). */
export async function replaceCatalogRewardRules(
  tx: Prisma.TransactionClient,
  productSlug: string,
  sanitized: RewardRuleDraft[],
): Promise<void> {
  await applyRewardRulesToCatalogProduct(tx, productSlug, sanitized);
}

/** @deprecated Use replaceCatalogRewardRules */
export async function replaceLinkedCardRewardRulesForCatalogSlug(
  tx: Prisma.TransactionClient,
  productSlug: string,
  sanitized: RewardRuleDraft[],
): Promise<number> {
  await replaceCatalogRewardRules(tx, productSlug, sanitized);
  return tx.creditCard.count({ where: { catalogProductSlug: productSlug } });
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

  const extract = parseRewardsExtract(proposal.proposedPayload);

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

    await applyExtractSnapshotToCatalog(
      tx,
      proposal.productSlug,
      proposal.proposedPayload,
      sanitized,
    );

    const linked = await tx.creditCard.count({
      where: { catalogProductSlug: proposal.productSlug },
    });

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
