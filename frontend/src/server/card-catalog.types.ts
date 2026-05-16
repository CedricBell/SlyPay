import type { EarningType, SpendCategory } from "@prisma/client";
import type { RotatingBonusQuarterSpec } from "@/server/rotating-bonus-calendar";

export type CardCatalogRule = {
  category: SpendCategory;
  multiplier: number;
  earningType: EarningType;
};

export type CardCatalogEntry = {
  id: string;
  name: string;
  issuer: string;
  colorHex?: string;
  /** Placeholder artwork for suggestions UI */
  imageUrl?: string;
  /**
   * Optional HTTPS URL to the issuer-hosted rewards/terms PDF for automated extraction.
   * Populate deliberately — fetching respects SSRF guards (https only, no localhost).
   */
  officialDocumentUrl?: string;
  /**
   * Rotating quarterly bonuses (e.g. 5% calendars). Synced to DB and merged at recommendation time.
   */
  rotatingBonusCalendar?: RotatingBonusQuarterSpec[];
  /**
   * Legacy UI helpers — intentionally empty at source of truth; use PDF-derived snapshots in DB.
   */
  rules: CardCatalogRule[];
  /**
   * Suggestion built from typed text — saving should send `intelAdHocFromName` so the server
   * upserts `CardCatalogProduct` and runs PDF discovery.
   */
  intelAdHocFromName?: boolean;
};
