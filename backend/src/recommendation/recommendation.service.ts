import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { decideBestCard } from '../engine/decision-engine';
import { EngineCard } from '../engine/decision-engine.types';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryResolverService } from './category-resolver.service';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';

function dec(n: Prisma.Decimal | number): number {
  if (typeof n === 'number') return n;
  return n.toNumber();
}

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryResolverService,
  ) {}

  async recommend(userId: string, dto: RecommendationRequestDto) {
    const resolution = await this.categories.resolve({
      categoryHint: dto.categoryHint,
      merchantName: dto.merchantName,
      mcc: dto.mcc,
    });

    const dbCards = await this.prisma.creditCard.findMany({
      where: { userId, isActive: true },
      include: {
        rewardRules: true,
        offers: true,
      },
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

    const explanation = {
      categoryTrace: resolution.trace,
      resolvedCategory: resolution.category,
      winner: engineResult.winner,
      ranked: engineResult.ranked,
      alternatesTied: engineResult.alternatesTied,
      edgeCase:
        engineResult.bestCardId === null
          ? 'NO_CARDS'
          : engineResult.alternatesTied.length
            ? 'TIED_TOP_CARDS'
            : null,
    };

    const persist = dto.persist !== false;

    if (persist) {
      await this.prisma.recommendation.create({
        data: {
          userId,
          amount: dto.amount,
          resolvedCategory: resolution.category,
          merchantName: dto.merchantName?.slice(0, 200),
          mcc: dto.mcc?.replace(/\D/g, '').slice(0, 4) || null,
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

    return {
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
    };
  }

  history(userId: string, limit = 30) {
    return this.prisma.recommendation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}
