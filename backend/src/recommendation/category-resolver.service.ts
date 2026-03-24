import { Injectable } from '@nestjs/common';
import { SpendCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CategoryResolution = {
  category: SpendCategory;
  trace: string[];
  merchantId?: string;
};

@Injectable()
export class CategoryResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: {
    categoryHint?: SpendCategory;
    merchantName?: string;
    mcc?: string;
  }): Promise<CategoryResolution> {
    const trace: string[] = [];

    if (input.categoryHint) {
      trace.push(`Category locked to ${input.categoryHint} (explicit hint).`);
      return { category: input.categoryHint, trace };
    }

    const rawName = input.merchantName?.trim();
    let resolvedMcc = input.mcc?.replace(/\D/g, '').slice(0, 4) || undefined;
    let merchantId: string | undefined;

    if (rawName) {
      const norm = rawName.toLowerCase();
      const merchant = await this.prisma.merchant.findFirst({
        where: {
          OR: [
            { normalized: norm },
            { displayName: { equals: rawName, mode: 'insensitive' } },
            { normalized: { contains: norm } },
          ],
        },
        include: {
          categoryMappings: { orderBy: { confidence: 'desc' } },
        },
        orderBy: { displayName: 'asc' },
      });

      if (merchant) {
        merchantId = merchant.id;
        trace.push(`Matched merchant "${merchant.displayName}".`);
        if (!resolvedMcc && merchant.mcc) {
          resolvedMcc = merchant.mcc;
          trace.push(`Inherited MCC ${resolvedMcc} from merchant record.`);
        }
        const top = merchant.categoryMappings[0];
        if (top) {
          trace.push(
            `Merchant category mapping (${top.source}) → ${top.category}.`,
          );
          return {
            category: top.category,
            trace,
            merchantId,
          };
        }
        trace.push('Merchant has no category mappings; trying MCC fallback.');
      } else {
        trace.push(
          `No merchant match for "${rawName}"; using MCC or OTHER fallback.`,
        );
      }
    }

    if (resolvedMcc && resolvedMcc.length === 4) {
      const mccRow = await this.prisma.mccCategoryMap.findUnique({
        where: { mcc: resolvedMcc },
      });
      if (mccRow) {
        trace.push(
          `MCC ${resolvedMcc} (${mccRow.label ?? 'generic'}) → ${mccRow.category}.`,
        );
        return { category: mccRow.category, trace, merchantId };
      }
      trace.push(`MCC ${resolvedMcc} not in reference table.`);
    }

    trace.push('Falling back to OTHER.');
    return { category: SpendCategory.OTHER, trace, merchantId };
  }
}
