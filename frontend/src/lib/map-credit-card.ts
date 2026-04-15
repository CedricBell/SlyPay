import type { CreditCard, Offer, RewardRule } from "@prisma/client";
import { dec } from "@/lib/serialize";

export type CardWithRules = CreditCard & {
  rewardRules: RewardRule[];
  offers: Offer[];
};

export function mapCreditCardJson(c: CardWithRules) {
  return {
    ...c,
    rewardRules: c.rewardRules.map((r) => ({
      ...r,
      multiplier: dec(r.multiplier),
      capAmountMonthly:
        r.capAmountMonthly != null ? dec(r.capAmountMonthly) : null,
    })),
    offers: c.offers.map((o) => ({
      ...o,
      multiplier: dec(o.multiplier),
    })),
  };
}
