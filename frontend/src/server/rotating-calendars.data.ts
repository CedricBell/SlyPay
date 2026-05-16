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
        "Typical quarterly categories: grocery stores, wholesale clubs, select streaming; activate on discover.com. 5% on up to $1,500/quarter combined, then 1%.",
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
