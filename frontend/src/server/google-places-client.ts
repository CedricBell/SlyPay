/** Server-only Google Places API (New). Requires Places API (New) enabled on the GCP project. */

export function getGooglePlacesApiKey(): string | null {
  const key =
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

type GoogleErrorBody = {
  error?: { message?: string; status?: string };
};

export async function googlePlacesPost<T>(
  path: string,
  body: unknown,
  fieldMask: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return { ok: false, status: 0, message: "GOOGLE_PLACES_API_KEY not configured" };
  }

  const res = await fetch(`https://places.googleapis.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as GoogleErrorBody;
      if (err.error?.message) message = err.error.message;
      if (err.error?.status) message = `${err.error.status}: ${message}`;
    } catch {
      /* ignore */
    }
    if (process.env.NODE_ENV === "development") {
      console.warn(`[google-places] ${path} failed:`, message);
    }
    return { ok: false, status: res.status, message };
  }

  const data = (await res.json()) as T;
  return { ok: true, data };
}

export type GooglePlaceTextHit = {
  placeId: string;
  displayName: string;
  formattedAddress?: string;
  lat?: number;
  lng?: number;
};

type TextSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
};

/** Merchant name autocomplete — any business worldwide, biased near user when coords provided. */
export async function searchGooglePlacesText(
  query: string,
  opts?: { lat?: number; lng?: number },
): Promise<GooglePlaceTextHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const body: Record<string, unknown> = {
    textQuery: q,
    maxResultCount: 15,
    languageCode: "en",
  };

  if (
    typeof opts?.lat === "number" &&
    typeof opts?.lng === "number" &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lng)
  ) {
    body.locationBias = {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lng },
        radius: 50_000,
      },
    };
  }

  const result = await googlePlacesPost<TextSearchResponse>(
    "places:searchText",
    body,
    "places.id,places.displayName,places.formattedAddress,places.location",
  );

  if (!result.ok) return [];

  const out: GooglePlaceTextHit[] = [];
  for (const p of result.data.places ?? []) {
    const displayName = p.displayName?.text?.trim();
    const placeId = p.id?.trim();
    if (!displayName || !placeId) continue;
    out.push({
      placeId,
      displayName,
      formattedAddress: p.formattedAddress,
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    });
  }
  return out;
}
