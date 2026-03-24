import { EarningType, OfferStackPolicy, SpendCategory } from '@prisma/client';
import { comparableRewardValue, decideBestCard } from './decision-engine';

describe('comparableRewardValue', () => {
  it('treats points as amount * multiplier', () => {
    expect(
      comparableRewardValue(100, 3, EarningType.POINTS),
    ).toBe(300);
  });

  it('treats cashback percent as amount * multiplier/100', () => {
    expect(
      comparableRewardValue(100, 2, EarningType.CASHBACK_PERCENT),
    ).toBe(2);
  });
});

describe('decideBestCard', () => {
  const now = new Date('2025-06-15T12:00:00Z');

  it('returns null when no cards', () => {
    const r = decideBestCard({
      amount: 50,
      resolvedCategory: SpendCategory.DINING,
      cards: [],
      now,
    });
    expect(r.bestCardId).toBeNull();
    expect(r.ranked).toHaveLength(0);
  });

  it('picks higher points card for dining', () => {
    const r = decideBestCard({
      amount: 100,
      resolvedCategory: SpendCategory.DINING,
      now,
      cards: [
        {
          id: 'a',
          name: 'Card A',
          issuer: 'Bank A',
          rules: [
            {
              category: SpendCategory.DINING,
              multiplier: 2,
              earningType: EarningType.POINTS,
              capAmountMonthly: null,
              priority: 0,
            },
          ],
          offers: [],
        },
        {
          id: 'b',
          name: 'Card B',
          issuer: 'Bank B',
          rules: [
            {
              category: SpendCategory.DINING,
              multiplier: 3,
              earningType: EarningType.POINTS,
              capAmountMonthly: null,
              priority: 0,
            },
          ],
          offers: [],
        },
      ],
    });
    expect(r.bestCardId).toBe('b');
    expect(r.winner?.comparableValue).toBe(300);
  });

  it('uses REPLACE_BASE offer over weaker base', () => {
    const r = decideBestCard({
      amount: 100,
      resolvedCategory: SpendCategory.GROCERIES,
      now,
      cards: [
        {
          id: 'c',
          name: 'Card C',
          issuer: 'Bank C',
          rules: [
            {
              category: SpendCategory.GROCERIES,
              multiplier: 1,
              earningType: EarningType.POINTS,
              capAmountMonthly: null,
              priority: 0,
            },
          ],
          offers: [
            {
              category: SpendCategory.GROCERIES,
              multiplier: 5,
              stackPolicy: OfferStackPolicy.REPLACE_BASE,
              validFrom: new Date('2025-06-01'),
              validUntil: new Date('2025-06-30'),
              title: 'Q2 Groceries',
            },
          ],
        },
      ],
    });
    expect(r.bestCardId).toBe('c');
    expect(r.winner?.effectiveMultiplier).toBe(5);
    expect(r.winner?.comparableValue).toBe(500);
  });

  it('stable tie-breaker by card id', () => {
    const r = decideBestCard({
      amount: 10,
      resolvedCategory: SpendCategory.OTHER,
      now,
      cards: [
        {
          id: 'z',
          name: 'Z',
          issuer: 'Z',
          rules: [
            {
              category: SpendCategory.OTHER,
              multiplier: 1,
              earningType: EarningType.POINTS,
              capAmountMonthly: null,
              priority: 0,
            },
          ],
          offers: [],
        },
        {
          id: 'a',
          name: 'A',
          issuer: 'A',
          rules: [
            {
              category: SpendCategory.OTHER,
              multiplier: 1,
              earningType: EarningType.POINTS,
              capAmountMonthly: null,
              priority: 0,
            },
          ],
          offers: [],
        },
      ],
    });
    expect(r.bestCardId).toBe('a');
    expect(r.alternatesTied).toContain('z');
  });

  it('falls back to OTHER rule when category missing', () => {
    const r = decideBestCard({
      amount: 20,
      resolvedCategory: SpendCategory.TRAVEL,
      now,
      cards: [
        {
          id: 'd',
          name: 'Card D',
          issuer: 'Bank D',
          rules: [
            {
              category: SpendCategory.OTHER,
              multiplier: 1.5,
              earningType: EarningType.POINTS,
              capAmountMonthly: null,
              priority: 0,
            },
          ],
          offers: [],
        },
      ],
    });
    expect(r.winner?.baseMultiplier).toBe(1.5);
  });
});
