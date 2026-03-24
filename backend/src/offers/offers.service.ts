import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, cardId?: string) {
    return this.prisma.offer.findMany({
      where: {
        creditCard: { userId },
        ...(cardId ? { creditCardId: cardId } : {}),
      },
      orderBy: { validFrom: 'desc' },
      include: { creditCard: { select: { id: true, name: true, issuer: true } } },
    });
  }

  async create(userId: string, dto: CreateOfferDto) {
    const card = await this.prisma.creditCard.findFirst({
      where: { id: dto.creditCardId, userId },
    });
    if (!card) {
      throw new ForbiddenException('Card not found for this user');
    }
    return this.prisma.offer.create({
      data: {
        creditCardId: dto.creditCardId,
        title: dto.title,
        category: dto.category,
        multiplier: dto.multiplier,
        stackPolicy: dto.stackPolicy,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
      include: { creditCard: { select: { id: true, name: true } } },
    });
  }

  async remove(userId: string, id: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { id },
      include: { creditCard: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.creditCard.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.offer.delete({ where: { id } });
    return { ok: true };
  }
}
