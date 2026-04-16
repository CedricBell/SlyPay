import { NextRequest, NextResponse } from "next/server";
import { SpendCategory } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAppUser } from "@/lib/session-user";
import { dec } from "@/lib/serialize";
import { resolveSpendCategory } from "@/server/category-resolver";
import { decideBestCard } from "@/server/decision-engine";
import type { EngineCard } from "@/server/decision-engine.types";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";

const bodySchema = z.object({
  amount: z.number().min(0.01),
  merchantName: z.string().max(200).optional(),
  mcc: z.string().max(8).optional(),
  categoryHint: z.nativeEnum(SpendCategory).optional(),
  persist: z.boolean().optional(),
});

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

  const dbCards = await prisma.creditCard.findMany({
    where: { userId: ctx.appUser.id, isActive: true },
    include: { rewardRules: true, offers: true },
  });

  const cards: EngineCard[] = dbCards.map((c) => ({
    id: c.id,
    name: c.name,
    issuer: c.issuer,
    rules: c.rewardRules.map((r) => ({
      category: r.category,
      multiplier: dec(r.multiplier),
      earningType: r.earningType,
      capAmountMonthly: r.capAmountMonthly ? dec(r.capAmountMonthly) : null,
      priority: r.priority,
    })),
    offers: c.offers.map((o) => ({
      category: o.category,
      multiplier: dec(o.multiplier),
      stackPolicy: o.stackPolicy,
      validFrom: o.validFrom,
      validUntil: o.validUntil,
      title: o.title,
    })),
  }));

  const engineResult = decideBestCard({
    amount: dto.amount,
    resolvedCategory: resolution.category,
    cards,
    now: new Date(),
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
    offers: [],
  }));
  const marketResult = decideBestCard({
    amount: dto.amount,
    resolvedCategory: resolution.category,
    cards: marketCards,
    now: new Date(),
  });

  const explanation = {
    categoryTrace: resolution.trace,
    resolvedCategory: resolution.category,
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

  if (persist) {
    await prisma.recommendation.create({
      data: {
        userId: ctx.appUser.id,
        amount: dto.amount,
        resolvedCategory: resolution.category,
        merchantName: dto.merchantName?.slice(0, 200),
        mcc: dto.mcc?.replace(/\D/g, "").slice(0, 4) || null,
        bestCardId: engineResult.bestCardId,
        explanation: explanation as object,
        alternates:
          engineResult.alternatesTied.length > 0
            ? engineResult.alternatesTied
            : undefined,
      },
    });
  }

  const bestCard = engineResult.bestCardId
    ? dbCards.find((c) => c.id === engineResult.bestCardId)
    : undefined;

  return NextResponse.json({
    amount: dto.amount,
    resolvedCategory: resolution.category,
    categoryResolution: {
      merchantId: resolution.merchantId,
      trace: resolution.trace,
    },
    bestCardId: engineResult.bestCardId,
    bestComparableValue: engineResult.bestComparableValue,
    bestCard: bestCard
      ? {
          id: bestCard.id,
          name: bestCard.name,
          issuer: bestCard.issuer,
          last4: bestCard.last4,
          colorHex: bestCard.colorHex,
        }
      : null,
    reasoning: engineResult.winner?.explanationLines ?? [],
    alternatesTied: engineResult.alternatesTied,
    ranked: engineResult.ranked.map((r) => ({
      cardId: r.cardId,
      cardName: r.cardName,
      issuer: r.issuer,
      comparableValue: r.comparableValue,
      effectiveMultiplier: r.effectiveMultiplier,
      earningType: r.earningType,
    })),
    marketBest: marketResult.winner
      ? {
          cardId: marketResult.winner.cardId,
          cardName: marketResult.winner.cardName,
          issuer: marketResult.winner.issuer,
          comparableValue: marketResult.winner.comparableValue,
          effectiveMultiplier: marketResult.winner.effectiveMultiplier,
          earningType: marketResult.winner.earningType,
          deltaVsWalletBest:
            marketResult.winner.comparableValue - engineResult.bestComparableValue,
        }
      : null,
  });
}
