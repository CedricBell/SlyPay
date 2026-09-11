import { EarningType } from "@prisma/client";
import type { RotatingBonusQuarterSpec } from "@/server/rotating-bonus-calendar";

/**
 * Curated calendars — update when issuers announce new quarters.
 * Sources (2026): Discover / Chase public calendars and press (e.g. Chase Q2 announcement).
 */
export const ROTATING_CALENDARS_BY_SLUG: Record<
  string,
  RotatingBonusQuarterSpec[]
> = {
  "discover-it": [
    {
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-03-31T23:59:59.999Z",
      categories: ["GROCERIES", "WHOLESALE", "ENTERTAINMENT"],
      multiplier: 5,
      earningType: EarningType.CASHBACK_PERCENT,
      label: "Discover it 5% Q1 2026 (Jan–Mar)",
      details:
        "Grocery stores, wholesale clubs, select streaming services. Activate at discover.com/credit-cards/cash-back/cashback-calendar.html — 5% on up to $1,500 combined purchases this quarter, then 1%. Not retroactive.",
    },
    {
      validFrom: "2026-04-01T00:00:00.000Z",
      validUntil: "2026-06-30T23:59:59.999Z",
      categories: ["DINING"],
      multiplier: 5,
      earningType: EarningType.CASHBACK_PERCENT,
      label: "Discover it 5% Q2 2026 (Apr–Jun)",
      details:
        "Restaurants and home improvement stores (building supply, lawn & garden, home furnishing/appliance). Activate on Discover — 5% on up to $1,500 combined this quarter, then 1%. Home improvement may not map to a single spend category in recommendations.",
    },
    {
      validFrom: "2026-07-01T00:00:00.000Z",
      validUntil: "2026-09-30T23:59:59.999Z",
      categories: ["GAS", "TRAVEL", "DRUGSTORES"],
      multiplier: 5,
      earningType: EarningType.CASHBACK_PERCENT,
      label: "Discover it 5% Q3 2026 (Jul–Sep)",
      details:
        "Gas stations, public transit/transportation, drug stores (per issuer calendar). Activate each quarter — 5% on up to $1,500 combined, then 1%.",
    },
  ],
  "chase-freedom-flex": [
    {
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-03-31T23:59:59.999Z",
      categories: ["DINING"],
      multiplier: 5,
      earningType: EarningType.CASHBACK_PERCENT,
      label: "Chase Freedom Flex 5% Q1 2026 (Jan–Mar)",
      details:
        "Includes dining and issuer-listed partners; activate each quarter. 5% on up to $1,500 combined category spend, then 1%.",
    },
    {
      validFrom: "2026-04-01T00:00:00.000Z",
      validUntil: "2026-06-30T23:59:59.999Z",
      categories: ["ONLINE_SHOPPING", "GROCERIES", "TRAVEL"],
      multiplier: 5,
      earningType: EarningType.CASHBACK_PERCENT,
      label: "Chase Freedom Flex 5% Q2 2026 (Apr–Jun)",
      details:
        "Amazon & Whole Foods (mapped to online shopping + groceries), Chase Travel; activate. 5% on up to $1,500 combined category spend, then 1%.",
    },
  ],
};
