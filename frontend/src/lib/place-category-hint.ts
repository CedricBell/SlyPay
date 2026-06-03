import { SpendCategory } from "@prisma/client";

const G_DINING = new Set([
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "food",
  "pub",
  "ice_cream_shop",
]);

const G_GROCERIES = new Set([
  "supermarket",
  "grocery_store",
  "convenience_store",
  "food_store",
]);

const G_GAS = new Set(["gas_station", "electric_vehicle_charging_station"]);

const G_DRUG = new Set(["pharmacy", "drugstore"]);

const G_ENT = new Set([
  "movie_theater",
  "amusement_park",
  "bowling_alley",
  "casino",
  "night_club",
  "stadium",
]);

const G_TRAVEL = new Set([
  "lodging",
  "hotel",
  "campground",
  "travel_agency",
  "airport",
  "train_station",
  "taxi_stand",
]);

const G_RETAIL = new Set(["shopping_mall", "department_store"]);

export function hintFromGoogleTypes(
  types: string[] | undefined,
): SpendCategory | null {
  if (!types?.length) return null;
  for (const x of types) {
    if (G_DRUG.has(x)) return SpendCategory.DRUGSTORES;
  }
  for (const x of types) {
    if (G_GAS.has(x)) return SpendCategory.GAS;
  }
  // Dining before groceries — Google often tags eateries with broad retail/food types
  for (const x of types) {
    if (G_DINING.has(x)) return SpendCategory.DINING;
  }
  for (const x of types) {
    if (G_GROCERIES.has(x)) return SpendCategory.GROCERIES;
  }
  for (const x of types) {
    if (G_ENT.has(x)) return SpendCategory.ENTERTAINMENT;
  }
  for (const x of types) {
    if (G_TRAVEL.has(x)) return SpendCategory.TRAVEL;
  }
  for (const x of types) {
    if (G_RETAIL.has(x)) return SpendCategory.ONLINE_SHOPPING;
  }
  return null;
}

export function hintFromOsmTags(tags: {
  amenity?: string;
  shop?: string;
  tourism?: string;
  leisure?: string;
}): SpendCategory | null {
  const a = tags.amenity;
  const s = tags.shop;
  const t = tags.tourism;
  const l = tags.leisure;

  if (a === "pharmacy") return SpendCategory.DRUGSTORES;
  if (a === "fuel" || a === "charging_station") return SpendCategory.GAS;

  if (
    a === "restaurant" ||
    a === "fast_food" ||
    a === "cafe" ||
    a === "bar" ||
    a === "pub" ||
    a === "biergarten" ||
    a === "food_court" ||
    a === "ice_cream"
  ) {
    return SpendCategory.DINING;
  }

  if (s === "bakery" || s === "pastry" || s === "confectionery") {
    return SpendCategory.DINING;
  }

  if (
    s === "supermarket" ||
    s === "convenience" ||
    s === "greengrocer" ||
    s === "health_food"
  ) {
    return SpendCategory.GROCERIES;
  }

  if (
    a === "cinema" ||
    a === "theatre" ||
    a === "nightclub" ||
    l === "bowling_alley" ||
    l === "amusement_arcade"
  ) {
    return SpendCategory.ENTERTAINMENT;
  }

  if (t === "hotel" || t === "guest_house" || t === "motel") {
    return SpendCategory.TRAVEL;
  }

  if (
    s === "mall" ||
    s === "department_store" ||
    s === "clothes" ||
    s === "electronics" ||
    s === "furniture" ||
    s === "jewelry" ||
    s === "sports" ||
    s === "toys" ||
    s === "books"
  ) {
    return SpendCategory.ONLINE_SHOPPING;
  }

  if (s === "wholesale" || a === "marketplace") {
    return SpendCategory.WHOLESALE;
  }

  return null;
}

/** Fallback when OSM/Google tags are missing — common venue words in names */
export function hintFromPlaceName(name: string): SpendCategory | null {
  const n = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  if (
    /\b(cafe|café|coffee|restaurant|resto|bistro|brasserie|pizzeria|sushi|grill|traiteur|crêperie|creperie|bar|pub|cantine)\b/u.test(
      n,
    )
  ) {
    return SpendCategory.DINING;
  }
  if (
    /\b(supermarche|supermarket|epicerie|grocery|monop|carrefour|franprix)\b/u.test(
      n,
    )
  ) {
    return SpendCategory.GROCERIES;
  }
  if (/\b(pharmacie|pharmacy|drugstore)\b/u.test(n)) {
    return SpendCategory.DRUGSTORES;
  }
  return null;
}

export function resolvePlaceCategoryHint(args: {
  name: string;
  fromTags?: SpendCategory | null;
}): SpendCategory | null {
  return args.fromTags ?? hintFromPlaceName(args.name);
}
