import { NextRequest, NextResponse } from "next/server";
import { SpendCategory } from "@prisma/client";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { loadNearbyPlaces } from "@/server/nearby-places";

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickMerchantCategory(
  mappings: Array<{ category: SpendCategory; confidence: { toString(): string } }>,
): SpendCategory | null {
  if (mappings.length === 0) return null;
  const sorted = [...mappings].sort(
    (a, b) => Number(b.confidence) - Number(a.confidence),
  );
  return sorted[0]?.category ?? null;
}

function categoriesConflict(
  placeHint: SpendCategory | null | undefined,
  merchantHint: SpendCategory | null | undefined,
): boolean {
  if (!placeHint || !merchantHint) return false;
  return placeHint !== merchantHint;
}

type NearbyRow = {
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  source: "osm" | "google";
};

export type NearbyMatch = {
  detectedName: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  source: "osm" | "google";
  merchant: {
    id: string;
    displayName: string;
    mcc: string | null;
    categoryHint: SpendCategory | null;
  } | null;
  confidence: number;
  suggestedCategoryHint: SpendCategory | null;
};

export async function GET(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ message: "Invalid coordinates" }, { status: 400 });
  }

  const { places, sources } = await loadNearbyPlaces(lat, lng);
  if (places.length === 0) {
    return NextResponse.json({
      userLat: lat,
      userLng: lng,
      nearby: [],
      matches: [],
      sources,
    });
  }

  const nearby: NearbyRow[] = places.map((p) => ({
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    distanceMeters: p.distanceMeters,
    source: p.source,
  }));

  const dbMerchants = await prisma.merchant.findMany({
    where: {
      OR: places.flatMap((p) => {
        const n = normalizeSearch(p.name);
        const loose = p.name.toLowerCase().trim();
        return [
          { normalized: { contains: n } },
          { displayName: { contains: loose, mode: "insensitive" } },
        ];
      }),
    },
    include: { categoryMappings: true },
    take: 40,
  });

  const matches: NearbyMatch[] = [];
  for (const p of places) {
    const n = normalizeSearch(p.name);
    const placeHint = p.suggestedCategoryHint;
    const best = dbMerchants
      .map((m) => {
        const dn = normalizeSearch(m.displayName);
        const mn = normalizeSearch(m.normalized);
        let score = 0;
        if (dn === n || mn === n) score += 100;
        if (dn.includes(n) || n.includes(dn)) score += 40;
        if (mn.includes(n) || n.includes(mn)) score += 30;
        return { merchant: m, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    const merchantCategoryHint = best
      ? pickMerchantCategory(best.merchant.categoryMappings)
      : null;

    const rejectFuzzyMatch =
      best &&
      best.score < 100 &&
      categoriesConflict(placeHint, merchantCategoryHint);

    if (!best || rejectFuzzyMatch) {
      matches.push({
        detectedName: p.name,
        lat: p.lat,
        lng: p.lng,
        distanceMeters: p.distanceMeters,
        source: p.source,
        merchant: null,
        confidence: 0,
        suggestedCategoryHint: placeHint,
      });
      continue;
    }

    matches.push({
      detectedName: p.name,
      lat: p.lat,
      lng: p.lng,
      distanceMeters: p.distanceMeters,
      source: p.source,
      merchant: {
        id: best.merchant.id,
        displayName: best.merchant.displayName,
        mcc: best.merchant.mcc,
        categoryHint: merchantCategoryHint,
      },
      confidence: best.score,
      suggestedCategoryHint: placeHint,
    });
  }

  return NextResponse.json({
    userLat: lat,
    userLng: lng,
    nearby,
    matches,
    sources,
  });
}
