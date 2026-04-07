import {
  PrismaClient,
  SpendCategory,
  EarningType,
  OfferStackPolicy,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@spendless.dev';
  const passwordHash = await bcrypt.hash('Demo12345!', 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  await prisma.merchant.upsert({
    where: { slug: 'whole-foods-market' },
    update: {
      displayName: 'Whole Foods Market',
      normalized: 'whole foods market',
      mcc: '5411',
    },
    create: {
      slug: 'whole-foods-market',
      displayName: 'Whole Foods Market',
      normalized: 'whole foods market',
      mcc: '5411',
    },
  });

  const wf = await prisma.merchant.findUniqueOrThrow({
    where: { slug: 'whole-foods-market' },
  });

  await prisma.merchantCategoryMapping.deleteMany({
    where: { merchantId: wf.id },
  });
  await prisma.merchantCategoryMapping.create({
    data: {
      merchantId: wf.id,
      category: SpendCategory.GROCERIES,
      source: 'MANUAL',
    },
  });

  await prisma.merchant.upsert({
    where: { slug: 'starbucks' },
    update: {
      displayName: 'Starbucks',
      normalized: 'starbucks',
      mcc: '5814',
    },
    create: {
      slug: 'starbucks',
      displayName: 'Starbucks',
      normalized: 'starbucks',
      mcc: '5814',
    },
  });

  const sb = await prisma.merchant.findUniqueOrThrow({
    where: { slug: 'starbucks' },
  });

  await prisma.merchantCategoryMapping.deleteMany({
    where: { merchantId: sb.id },
  });
  await prisma.merchantCategoryMapping.create({
    data: {
      merchantId: sb.id,
      category: SpendCategory.DINING,
      source: 'MANUAL',
    },
  });

  const mccRows: Array<{
    mcc: string;
    category: SpendCategory;
    label: string;
  }> = [
    { mcc: '5411', category: SpendCategory.GROCERIES, label: 'Grocery stores' },
    { mcc: '5812', category: SpendCategory.DINING, label: 'Restaurants' },
    { mcc: '5814', category: SpendCategory.DINING, label: 'Fast food' },
    { mcc: '5541', category: SpendCategory.GAS, label: 'Gas stations' },
    { mcc: '3000', category: SpendCategory.TRAVEL, label: 'Airlines' },
  ];

  for (const row of mccRows) {
    await prisma.mccCategoryMap.upsert({
      where: { mcc: row.mcc },
      create: row,
      update: { category: row.category, label: row.label },
    });
  }

  const existingCards = await prisma.creditCard.count({
    where: { userId: user.id },
  });

  if (existingCards === 0) {
  const sapphire = await prisma.creditCard.create({
    data: {
      userId: user.id,
      name: 'Sapphire Reserve (demo)',
      issuer: 'Chase',
      last4: '4242',
      colorHex: '#0f172a',
      rewardRules: {
        create: [
          {
            category: SpendCategory.TRAVEL,
            multiplier: 3,
            earningType: EarningType.POINTS,
          },
          {
            category: SpendCategory.DINING,
            multiplier: 3,
            earningType: EarningType.POINTS,
          },
          {
            category: SpendCategory.OTHER,
            multiplier: 1,
            earningType: EarningType.POINTS,
          },
        ],
      },
    },
  });

  await prisma.creditCard.create({
    data: {
      userId: user.id,
      name: 'Cash Back (demo)',
      issuer: 'Example Bank',
      last4: '1234',
      colorHex: '#14532d',
      rewardRules: {
        create: [
          {
            category: SpendCategory.GROCERIES,
            multiplier: 5,
            earningType: EarningType.CASHBACK_PERCENT,
          },
          {
            category: SpendCategory.OTHER,
            multiplier: 1.5,
            earningType: EarningType.CASHBACK_PERCENT,
          },
        ],
      },
    },
  });

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 45);

  await prisma.offer.create({
    data: {
      creditCardId: sapphire.id,
      title: 'Limited travel boost',
      category: SpendCategory.TRAVEL,
      multiplier: 5,
      stackPolicy: OfferStackPolicy.REPLACE_BASE,
      validFrom: new Date(now.getTime() - 86400000),
      validUntil: end,
    },
  });
  }

  const promote = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (promote) {
    const r = await prisma.user.updateMany({
      where: { email: promote },
      data: { role: UserRole.ADMIN },
    });
    if (r.count === 0) {
      console.warn(
        `[seed] SEED_ADMIN_EMAIL=${promote}: aucun compte — inscris-toi puis relance le seed.`,
      );
    } else {
      console.log(`[seed] Compte ${promote} promu ADMIN`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
