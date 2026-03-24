import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, take = 50) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
      include: { merchant: true },
    });
  }

  async create(userId: string, dto: CreateTransactionDto) {
    if (dto.merchantId) {
      const m = await this.prisma.merchant.findUnique({
        where: { id: dto.merchantId },
      });
      if (!m) throw new NotFoundException('Merchant not found');
    }
    return this.prisma.transaction.create({
      data: {
        userId,
        amount: dto.amount,
        merchantId: dto.merchantId,
        category: dto.category,
        mcc: dto.mcc?.replace(/\D/g, '').slice(0, 4) || undefined,
        note: dto.note,
        currency: dto.currency ?? 'USD',
      },
      include: { merchant: true },
    });
  }
}
