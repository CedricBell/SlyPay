import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCreditCardDto } from './dto/create-credit-card.dto';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto';

const cardInclude = {
  rewardRules: true,
  offers: true,
} satisfies Prisma.CreditCardInclude;

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.creditCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: cardInclude,
    });
  }

  async get(userId: string, id: string) {
    const card = await this.prisma.creditCard.findFirst({
      where: { id, userId },
      include: cardInclude,
    });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  async create(userId: string, dto: CreateCreditCardDto) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.creditCard.create({
        data: {
          userId,
          name: dto.name,
          issuer: dto.issuer,
          last4: dto.last4,
          colorHex: dto.colorHex,
          isActive: dto.isActive ?? true,
        },
        include: cardInclude,
      });
      if (dto.rules?.length) {
        await tx.rewardRule.createMany({
          data: dto.rules.map((r) => ({
            creditCardId: card.id,
            category: r.category,
            multiplier: r.multiplier,
            earningType: r.earningType ?? undefined,
            capAmountMonthly: r.capAmountMonthly ?? undefined,
            priority: r.priority ?? 0,
            notes: r.notes,
          })),
        });
      }
      return tx.creditCard.findFirstOrThrow({
        where: { id: card.id },
        include: cardInclude,
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateCreditCardDto) {
    await this.ensureOwner(userId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.creditCard.update({
        where: { id },
        data: {
          name: dto.name,
          issuer: dto.issuer,
          last4: dto.last4,
          colorHex: dto.colorHex,
          isActive: dto.isActive,
        },
      });
      if (dto.rules) {
        await tx.rewardRule.deleteMany({ where: { creditCardId: id } });
        if (dto.rules.length) {
          await tx.rewardRule.createMany({
            data: dto.rules.map((r) => ({
              creditCardId: id,
              category: r.category,
              multiplier: r.multiplier,
              earningType: r.earningType ?? undefined,
              capAmountMonthly: r.capAmountMonthly ?? undefined,
              priority: r.priority ?? 0,
              notes: r.notes,
            })),
          });
        }
      }
      return tx.creditCard.findFirstOrThrow({
        where: { id },
        include: cardInclude,
      });
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwner(userId, id);
    await this.prisma.creditCard.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureOwner(userId: string, cardId: string) {
    const c = await this.prisma.creditCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!c) throw new NotFoundException('Card not found');
  }
}
