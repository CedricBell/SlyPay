import { SpendCategory } from "@prisma/client";
import {
  hintFromGoogleTypes,
  hintFromOsmTags,
  resolvePlaceCategoryHint,
} from "@/lib/place-category-hint";
import {
  getGooglePlacesApiKey,
  googlePlacesPost,
} from "@/server/google-places-client";

export type EnrichedPlace = {
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  source: "osm" | "google";
  suggestedCategoryHint: SpendCategory | null;
};

type OsmElement = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    amenity?: string;
    shop?: string;
    tourism?: string;
    leisure?: string;
  };
};

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Broad retail, dining, services — OpenStreetMap via Overpass */
function buildOverpassQuery(lat: number, lng: number, radius: number): string {
  const shop =
    "supermarket|convenience|department_store|mall|chemist|health_food|bakery|butcher|seafood|deli|alcohol|beverages|kiosk|general|variety_store|sports|clothes|shoes|bag|jewelry|electronics|mobile_phone|computer|furniture|doityourself|hardware|car|car_repair|pet|cosmetics|beauty|gift|books|stationery|newsagent|toys|wine|optician|florist|video|music|hairdresser";
  const amenity =
    "pharmacy|fuel|restaurant|fast_food|cafe|bar|pub|biergarten|food_court|ice_cream|marketplace|bank|atm|cinema|theatre|nightclub|charging_station|car_wash|dentist|doctors|clinic|hospital|car_rental|bicycle_rental";
  const leisure =
    "fitness_centre|sports_centre|bowling_alley|amusement_arcade|adult_gaming_centre";
  const tourism = "hotel|guest_house|motel|hostel";

  return `
[out:json][timeout:15];
(
  node(around:${radius},${lat},${lng})["shop"~"${shop}"];
  node(around:${radius},${lat},${lng})["amenity"~"${amenity}"];
  node(around:${radius},${lat},${lng})["leisure"~"${leisure}"];
  node(around:${radius},${lat},${lng})["tourism"~"${tourism}"];
  way(around:${radius},${lat},${lng})["shop"~"${shop}"];
  way(around:${radius},${lat},${lng})["amenity"~"${amenity}"];
  way(around:${radius},${lat},${lng})["leisure"~"${leisure}"];
  way(around:${radius},${lat},${lng})["tourism"~"${tourism}"];
  relation(around:${radius},${lat},${lng})["shop"~"${shop}"];
  relation(around:${radius},${lat},${lng})["amenity"~"${amenity}"];
  relation(around:${radius},${lat},${lng})["leisure"~"${leisure}"];
  relation(around:${radius},${lat},${lng})["tourism"~"${tourism}"];
);
out center tags;
`;
}

async function fetchOsmPlaces(
  lat: number,
  lng: number,
  radius: number,
): Promise<EnrichedPlace[]> {
  const query = buildOverpassQuery(lat, lng, radius);
  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
    cache: "no-store",
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as { elements?: OsmElement[] };

  const seen = new Set<string>();
  const list: EnrichedPlace[] = [];

  for (const e of data.elements ?? []) {
    const name = e.tags?.name?.trim();
    if (!name) continue;
    const key = normalizeSearch(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const pLat = e.lat ?? e.center?.lat;
    const pLng = e.lon ?? e.center?.lon;
    if (typeof pLat !== "number" || typeof pLng !== "number") continue;

    const hint = resolvePlaceCategoryHint({
      name,
      fromTags: hintFromOsmTags({
        amenity: e.tags?.amenity,
        shop: e.tags?.shop,
        tourism: e.tags?.tourism,
        leisure: e.tags?.leisure,
      }),
    });

    list.push({
      name,
      lat: pLat,
      lng: pLng,
      distanceMeters: distanceMeters(lat, lng, pLat, pLng),
      source: "osm",
      suggestedCategoryHint: hint,
    });
  }

  return list;
}

type GoogleNearbyResponse = {
  places?: Array<{
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    types?: string[];
  }>;
};

/** Table A place types — batched to avoid INVALID_ARGUMENT and omit tourist landmarks. */
const GOOGLE_NEARBY_TYPE_BATCHES: string[][] = [
  ["restaurant", "cafe", "bar", "bakery", "meal_takeaway", "meal_delivery"],
  ["supermarket", "grocery_store", "convenience_store"],
  ["gas_station", "pharmacy"],
  [
    "clothing_store",
    "electronics_store",
    "department_store",
    "shopping_mall",
    "home_goods_store",
    "hardware_store",
    "book_store",
    "pet_store",
    "furniture_store",
    "jewelry_store",
    "shoe_store",
    "sporting_goods_store",
    "liquor_store",
  ],
];

const GOOGLE_LANDMARK_ONLY = new Set([
  "tourist_attraction",
  "locality",
  "political",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "neighborhood",
  "sublocality",
  "sublocality_level_1",
  "route",
  "park",
  "town_square",
  "plaza",
  "historical_landmark",
  "monument",
]);

function googlePlaceIsSpendVenue(
  types: string[] | undefined,
  name: string,
): boolean {
  if (resolvePlaceCategoryHint({ name, fromTags: hintFromGoogleTypes(types) })) {
    return true;
  }
  if (!types?.length) return false;
  const meaningful = types.filter(
    (t) =>
      !GOOGLE_LANDMARK_ONLY.has(t) &&
      t !== "point_of_interest" &&
      t !== "establishment" &&
      t !== "geocode" &&
      t !== "premise",
  );
  return meaningful.length > 0;
}

async function fetchGoogleNearbyBatch(
  lat: number,
  lng: number,
  includedTypes: string[],
): Promise<EnrichedPlace[]> {
  const result = await googlePlacesPost<GoogleNearbyResponse>(
    "places:searchNearby",
    {
      includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 1500,
        },
      },
      rankPreference: "DISTANCE",
    },
    "places.displayName,places.location,places.types",
  );

  if (!result.ok) return [];
  const out: EnrichedPlace[] = [];

  for (const p of result.data.places ?? []) {
    const name = p.displayName?.text?.trim();
    const plat = p.location?.latitude;
    const plng = p.location?.longitude;
    if (!name || typeof plat !== "number" || typeof plng !== "number") continue;
    if (!googlePlaceIsSpendVenue(p.types, name)) continue;

    out.push({
      name,
      lat: plat,
      lng: plng,
      distanceMeters: distanceMeters(lat, lng, plat, plng),
      source: "google",
      suggestedCategoryHint: resolvePlaceCategoryHint({
        name,
        fromTags: hintFromGoogleTypes(p.types),
      }),
    });
  }

  return out;
}

async function fetchGoogleNearbyPlaces(
  lat: number,
  lng: number,
): Promise<EnrichedPlace[]> {
  const batches = await Promise.all(
    GOOGLE_NEARBY_TYPE_BATCHES.map((types) =>
      fetchGoogleNearbyBatch(lat, lng, types),
    ),
  );
  return batches.flat();
}

function mergePlaces(lists: EnrichedPlace[]): EnrichedPlace[] {
  const best = new Map<string, EnrichedPlace>();
  for (const p of lists) {
    const key = normalizeSearch(p.name);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || p.distanceMeters < prev.distanceMeters) {
      best.set(key, p);
    } else if (prev && !prev.suggestedCategoryHint && p.suggestedCategoryHint) {
      best.set(key, { ...prev, suggestedCategoryHint: p.suggestedCategoryHint });
    }
  }
  const spendRank = (hint: SpendCategory | null) => {
    if (!hint) return 0;
    if (hint === SpendCategory.TRAVEL) return 1;
    return 2;
  };

  return [...best.values()]
    .sort((a, b) => {
      const rank =
        spendRank(b.suggestedCategoryHint) - spendRank(a.suggestedCategoryHint);
      if (rank !== 0) return rank;
      return a.distanceMeters - b.distanceMeters;
    })
    .slice(0, 80);
}

export async function loadNearbyPlaces(
  lat: number,
  lng: number,
): Promise<{
  places: EnrichedPlace[];
  sources: Array<"osm" | "google">;
  googleConfigured: boolean;
  googleError?: string;
}> {
  const apiKey = getGooglePlacesApiKey();
  const osmPromise = fetchOsmPlaces(lat, lng, 1200);
  let googleError: string | undefined;
  const googlePromise = apiKey
    ? fetchGoogleNearbyPlaces(lat, lng).catch((e) => {
        googleError =
          e instanceof Error ? e.message : "Google nearby search failed";
        return [] as EnrichedPlace[];
      })
    : Promise.resolve([] as EnrichedPlace[]);

  const [osm, google] = await Promise.all([osmPromise, googlePromise]);
  const sources: Array<"osm" | "google"> = ["osm"];
  if (google.length) sources.push("google");

  const merged = mergePlaces([...osm, ...google]);
  return {
    places: merged,
    sources,
    googleConfigured: Boolean(apiKey),
    ...(googleError ? { googleError } : {}),
  };
}
