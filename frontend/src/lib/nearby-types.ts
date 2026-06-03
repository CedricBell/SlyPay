import type { SpendCategory } from "@prisma/client";
import { categoryLabelFromUi } from "@/lib/spend-category-ui";

export type NearbyMatch = {
  detectedName: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  source?: "osm" | "google";
  merchant: {
    id: string;
    displayName: string;
    mcc: string | null;
    categoryHint?: SpendCategory | null;
  } | null;
  confidence: number;
  suggestedCategoryHint?: SpendCategory | null;
};

export type NearbyResponse = {
  userLat: number;
  userLng: number;
  nearby: Array<{
    name: string;
    lat: number;
    lng: number;
    distanceMeters: number;
    source?: string;
  }>;
  matches: NearbyMatch[];
  sources?: Array<"osm" | "google">;
};

export type ConfidenceTier = "high" | "medium" | "low";

export function placeKey(m: NearbyMatch): string {
  return m.merchant?.id ?? `${m.detectedName}:${m.lat.toFixed(5)}:${m.lng.toFixed(5)}`;
}

export function confidenceTier(m: NearbyMatch): ConfidenceTier {
  if (!m.merchant) return "low";
  if (m.confidence >= 100 && m.distanceMeters <= 220) return "high";
  if (m.confidence >= 55 || m.distanceMeters <= 110) return "medium";
  return "low";
}

export function displayName(m: NearbyMatch): string {
  return m.merchant?.displayName ?? m.detectedName;
}

export function matchCategory(m: NearbyMatch): SpendCategory | null {
  const placeHint = m.suggestedCategoryHint ?? null;
  const merchantHint = m.merchant?.categoryHint ?? null;

  if (
    placeHint &&
    (!merchantHint || m.confidence < 100 || placeHint !== merchantHint)
  ) {
    return placeHint;
  }

  return merchantHint ?? placeHint ?? null;
}

export function categoryLabel(
  category: SpendCategory | null | undefined,
): string | null {
  if (!category) return null;
  return categoryLabelFromUi(category);
}

export function matchCategoryLabel(m: NearbyMatch): string | null {
  return categoryLabel(matchCategory(m));
}
