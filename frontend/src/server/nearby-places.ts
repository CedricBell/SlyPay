import { SpendCategory } from "@prisma/client";
import {
  hintFromGoogleTypes,
  hintFromOsmTags,
} from "@/lib/place-category-hint";

export type EnrichedPlace = {
  name: string;
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
  const tourism = "hotel|guest_house|motel|hostel|attraction|museum|gallery";

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

    const hint = hintFromOsmTags({
      amenity: e.tags?.amenity,
      shop: e.tags?.shop,
      tourism: e.tags?.tourism,
      leisure: e.tags?.leisure,
    });

    list.push({
      name,
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

async function fetchGoogleNearbyPlaces(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<EnrichedPlace[]> {
  const body = {
    includedTypes: [
      "restaurant",
      "cafe",
      "bar",
      "supermarket",
      "pharmacy",
      "gas_station",
      "clothing_store",
      "electronics_store",
      "department_store",
      "shopping_mall",
    ],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 500,
      },
    },
  };

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.displayName,places.location,places.types",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!res.ok) return [];
  const data = (await res.json()) as GoogleNearbyResponse;
  const out: EnrichedPlace[] = [];

  for (const p of data.places ?? []) {
    const name = p.displayName?.text?.trim();
    const plat = p.location?.latitude;
    const plng = p.location?.longitude;
    if (!name || typeof plat !== "number" || typeof plng !== "number") continue;

    out.push({
      name,
      distanceMeters: distanceMeters(lat, lng, plat, plng),
      source: "google",
      suggestedCategoryHint: hintFromGoogleTypes(p.types),
    });
  }

  return out;
}

function mergePlaces(lists: EnrichedPlace[]): EnrichedPlace[] {
  const best = new Map<string, EnrichedPlace>();
  for (const p of lists) {
    const key = normalizeSearch(p.name);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || p.distanceMeters < prev.distanceMeters) {
      best.set(key, p);
    }
  }
  return [...best.values()]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 48);
}

export async function loadNearbyPlaces(
  lat: number,
  lng: number,
): Promise<{
  places: EnrichedPlace[];
  sources: Array<"osm" | "google">;
}> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const osmPromise = fetchOsmPlaces(lat, lng, 500);
  const googlePromise = apiKey
    ? fetchGoogleNearbyPlaces(lat, lng, apiKey)
    : Promise.resolve([]);

  const [osm, google] = await Promise.all([osmPromise, googlePromise]);
  const sources: Array<"osm" | "google"> = ["osm"];
  if (google.length) sources.push("google");

  const merged = mergePlaces([...osm, ...google]);
  return { places: merged, sources };
}
