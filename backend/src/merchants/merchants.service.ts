import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  search(q: string, take = 20) {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return this.prisma.merchant.findMany({
      where: {
        OR: [
          { normalized: { contains: n } },
          { displayName: { contains: q.trim(), mode: 'insensitive' } },
        ],
      },
      take,
      orderBy: { displayName: 'asc' },
      include: { categoryMappings: true },
    });
  }

  async create(dto: CreateMerchantDto) {
    const normalized = dto.displayName.trim().toLowerCase();
    let base = slugify(dto.displayName);
    let slug = base;
    let n = 0;
    while (
      await this.prisma.merchant.findUnique({ where: { slug } })
    ) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.merchant.create({
        data: {
          slug,
          displayName: dto.displayName.trim(),
          normalized,
          mcc: dto.mcc,
          notes: dto.notes,
        },
      });
      if (dto.categories?.length) {
        await tx.merchantCategoryMapping.createMany({
          data: dto.categories.map((c) => ({
            merchantId: m.id,
            category: c.category,
            source: 'MANUAL',
          })),
          skipDuplicates: true,
        });
      }
      return tx.merchant.findUniqueOrThrow({
        where: { id: m.id },
        include: { categoryMappings: true },
      });
    });
  }
}
