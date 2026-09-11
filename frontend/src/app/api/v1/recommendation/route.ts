import { NextRequest, NextResponse } from "next/server";
import { SpendCategory } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAppUser } from "@/lib/session-user";
import { dec } from "@/lib/serialize";
import {
  buildCardSpendBenefits,
  filterRotatingQuartersForCategory,
  REFERENCE_PURCHASE_USD,
} from "@/lib/recommendation-benefits";
import { rotatingRelevanceNote } from "@/lib/rotating-rewards";
import { resolveSpendCategory } from "@/server/category-resolver";
import { decideBestCard } from "@/server/decision-engine";
import type { EngineCard } from "@/server/decision-engine.types";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { rewardRulesForWalletCard } from "@/lib/credit-card-rules";
import { catalogImageSrcForDisplay } from "@/lib/catalog-image-display";
import {
  resolveCatalogImageUrl,
  resolveCatalogImageUrlByIssuerAndName,
} from "@/server/catalog-card-art";
import {
  mergeEngineOffers,
  rotatingCalendarToEngineOffers,
} from "@/server/rotating-bonus-calendar";

const bodySchema = z.object({
  merchantName: z.string().max(200).optional(),
  mcc: z.string().max(8).optional(),
  categoryHint: z.nativeEnum(SpendCategory).optional(),
  persist: z.boolean().optional(),
});

function catalogImageForWalletCard(
  card: {
    name: string;
    issuer: string;
    catalogProductSlug: string | null;
    catalogProduct?: { slug: string; imageUrl: string | null } | null;
  },
): string | null {
  const raw =
    resolveCatalogImageUrl(
      card.catalogProduct?.slug ?? card.catalogProductSlug ?? "",
      { imageUrl: card.catalogProduct?.imageUrl ?? null },
    ) ??
    resolveCatalogImageUrlByIssuerAndName(card.issuer, card.name) ??
    null;
  return catalogImageSrcForDisplay(raw);
}

function catalogExtractForCard(
  card: {
    catalogProduct?: { slug: string; lastExtractJson: unknown } | null;
    catalogProductSlug: string | null;
  },
): unknown {
  if (card.catalogProduct?.lastExtractJson != null) {
    return card.catalogProduct.lastExtractJson;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let dto: z.infer<typeof bodySchema>;
  try {
    dto = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof z.ZodError ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  const resolution = await resolveSpendCategory(prisma, {
    categoryHint: dto.categoryHint,
    merchantName: dto.merchantName,
    mcc: dto.mcc,
  });

  const now = new Date();
  const merchantName = dto.merchantName?.trim() || null;

  const dbCards = await prisma.creditCard.findMany({
    where: { userId: ctx.appUser.id, isActive: true },
    include: {
      offers: true,
      catalogProduct: {
        select: {
          slug: true,
          imageUrl: true,
          rotatingBonusCalendar: true,
          rewardRules: true,
          lastExtractJson: true,
        },
      },
    },
  });

  const cards: EngineCard[] = dbCards.map((c) => {
    const manualOffers = c.offers.map((o) => ({
      category: o.category,
      multiplier: dec(o.multiplier),
      stackPolicy: o.stackPolicy,
      validFrom: o.validFrom,
      validUntil: o.validUntil,
      title: o.title,
    }));
    const calJson =
      c.catalogProduct?.rotatingBonusCalendar ??
      CARD_CATALOG_ENTRIES.find(
        (e) => e.id === (c.catalogProduct?.slug ?? c.catalogProductSlug),
      )?.rotatingBonusCalendar ??
      null;
    return {
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      rules: rewardRulesForWalletCard(c).map((r) => ({
        category: r.category,
        multiplier: dec(r.multiplier),
        earningType: r.earningType,
        capAmountMonthly: r.capAmountMonthly ? dec(r.capAmountMonthly) : null,
        priority: r.priority,
        excludedMerchants: r.excludedMerchants ?? [],
      })),
      offers: mergeEngineOffers(
        manualOffers,
        rotatingCalendarToEngineOffers(calJson),
      ),
    };
  });

  const engineResult = decideBestCard({
    resolvedCategory: resolution.category,
    cards,
    merchantName,
    now,
  });

  const marketCards: EngineCard[] = CARD_CATALOG_ENTRIES.map((c) => ({
    id: `catalog:${c.id}`,
    name: c.name,
    issuer: c.issuer,
    rules: c.rules.map((r) => ({
      category: r.category,
      multiplier: r.multiplier,
      earningType: r.earningType,
      capAmountMonthly: null,
      priority: 0,
    })),
    offers: rotatingCalendarToEngineOffers(c.rotatingBonusCalendar ?? null),
  }));

  const marketResult = decideBestCard({
    resolvedCategory: resolution.category,
    cards: marketCards,
    now,
  });

  const scoreByCardId = new Map(
    engineResult.ranked.map((r) => [r.cardId, r]),
  );

  const ranked = engineResult.ranked.map((r) => {
    const card = dbCards.find((c) => c.id === r.cardId);
    const matchedRule = card
      ? rewardRulesForWalletCard(card).find(
          (rule) => rule.category === resolution.category,
        )
      : undefined;
    const calJson =
      card?.catalogProduct?.rotatingBonusCalendar ??
      CARD_CATALOG_ENTRIES.find(
        (e) =>
          e.id === (card?.catalogProduct?.slug ?? card?.catalogProductSlug),
      )?.rotatingBonusCalendar ??
      null;
    const benefits = buildCardSpendBenefits({
      extractJson: card ? catalogExtractForCard(card) : null,
      category: resolution.category,
      merchantName,
      effectiveMultiplier: r.effectiveMultiplier,
      earningType: r.earningType,
      engineLines: r.explanationLines,
      merchantExcluded: r.merchantExcluded,
      ruleExcludedMerchants: matchedRule?.excludedMerchants,
      rotatingContextNote: calJson
        ? rotatingRelevanceNote(calJson, resolution.category, now)
        : null,
    });
    return {
      cardId: r.cardId,
      cardName: r.cardName,
      issuer: r.issuer,
      effectiveMultiplier: r.effectiveMultiplier,
      earningType: r.earningType,
      rateLabel: benefits.rateLabel,
      last4: card?.last4 ?? null,
      colorHex: card?.colorHex ?? null,
      catalogImageUrl: card ? catalogImageForWalletCard(card) : null,
      benefits,
      explanationLines: r.explanationLines,
      catalogRotatingQuarters: filterRotatingQuartersForCategory(
        calJson,
        resolution.category,
        now,
      ),
    };
  });

  const winnerScore = engineResult.bestCardId
    ? scoreByCardId.get(engineResult.bestCardId)
    : undefined;
  const bestWallet = engineResult.bestCardId
    ? dbCards.find((c) => c.id === engineResult.bestCardId)
    : undefined;

  const bestCalJson =
    bestWallet?.catalogProduct?.rotatingBonusCalendar ??
    CARD_CATALOG_ENTRIES.find(
      (e) =>
        e.id ===
        (bestWallet?.catalogProduct?.slug ?? bestWallet?.catalogProductSlug),
    )?.rotatingBonusCalendar ??
    null;

  const bestCardBenefits =
    winnerScore && bestWallet
      ? buildCardSpendBenefits({
          extractJson: catalogExtractForCard(bestWallet),
          category: resolution.category,
          merchantName,
          effectiveMultiplier: winnerScore.effectiveMultiplier,
          earningType: winnerScore.earningType,
          engineLines: winnerScore.explanationLines,
          merchantExcluded: winnerScore.merchantExcluded,
          ruleExcludedMerchants: rewardRulesForWalletCard(bestWallet).find(
            (rule) => rule.category === resolution.category,
          )?.excludedMerchants,
          rotatingContextNote: bestCalJson
            ? rotatingRelevanceNote(bestCalJson, resolution.category, now)
            : null,
        })
      : null;

  const explanation = {
    categoryTrace: resolution.trace,
    resolvedCategory: resolution.category,
    merchantName,
    winner: engineResult.winner,
    ranked: engineResult.ranked,
    alternatesTied: engineResult.alternatesTied,
    edgeCase:
      engineResult.bestCardId === null
        ? "NO_CARDS"
        : engineResult.alternatesTied.length
          ? "TIED_TOP_CARDS"
          : null,
  };

  const persist = dto.persist !== false;

  let recommendationId: string | null = null;
  if (persist) {
    const created = await prisma.recommendation.create({
      data: {
        userId: ctx.appUser.id,
        amount: REFERENCE_PURCHASE_USD,
        resolvedCategory: resolution.category,
        merchantName: merchantName?.slice(0, 200) ?? null,
        mcc: dto.mcc?.replace(/\D/g, "").slice(0, 4) || null,
        bestCardId: engineResult.bestCardId,
        explanation: explanation as object,
        alternates:
          engineResult.alternatesTied.length > 0
            ? engineResult.alternatesTied
            : undefined,
      },
    });
    recommendationId = created.id;
  }

  const marketWinner = marketResult.winner;
  const marketCatalogEntry = marketWinner
    ? CARD_CATALOG_ENTRIES.find(
        (e) => `catalog:${e.id}` === marketWinner.cardId,
      )
    : undefined;

  const marketBenefits = marketWinner
    ? buildCardSpendBenefits({
        extractJson: null,
        category: resolution.category,
        merchantName,
        effectiveMultiplier: marketWinner.effectiveMultiplier,
        earningType: marketWinner.earningType,
        engineLines: marketWinner.explanationLines,
      })
    : null;

  return NextResponse.json({
    recommendationId,
    evaluationDate: now.toISOString(),
    resolvedCategory: resolution.category,
    categoryResolution: {
      merchantId: resolution.merchantId,
      trace: resolution.trace,
    },
    bestCardId: engineResult.bestCardId,
    bestCard: bestWallet
      ? {
          id: bestWallet.id,
          name: bestWallet.name,
          issuer: bestWallet.issuer,
          last4: bestWallet.last4,
          colorHex: bestWallet.colorHex,
          catalogImageUrl: catalogImageForWalletCard(bestWallet),
        }
      : null,
    bestCardBenefits,
    reasoning: engineResult.winner?.explanationLines ?? [],
    alternatesTied: engineResult.alternatesTied,
    ranked,
    marketBest: marketWinner
      ? {
          cardId: marketWinner.cardId,
          cardName: marketWinner.cardName,
          issuer: marketWinner.issuer,
          effectiveMultiplier: marketWinner.effectiveMultiplier,
          earningType: marketWinner.earningType,
          rateLabel: marketBenefits?.rateLabel ?? "",
          benefits: marketBenefits,
          catalogName: marketCatalogEntry?.name ?? marketWinner.cardName,
        }
      : null,
  });
}
