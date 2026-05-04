import { NextRequest, NextResponse } from "next/server";
import { SpendCategory } from "@prisma/client";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { loadNearbyPlaces } from "@/server/nearby-places";

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type NearbyRow = {
  name: string;
  distanceMeters: number;
  source: "osm" | "google";
};

type NearbyMatch = {
  detectedName: string;
  distanceMeters: number;
  source: "osm" | "google";
  merchant: {
    id: string;
    displayName: string;
    mcc: string | null;
    categoryHint: SpendCategory | null;
  } | null;
  confidence: number;
  /** When no DB merchant match — OSM/Google-derived spend category */
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
      nearby: [],
      matches: [],
      sources,
    });
  }

  const nearby: NearbyRow[] = places.map((p) => ({
    name: p.name,
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

    if (!best) {
      matches.push({
        detectedName: p.name,
        distanceMeters: p.distanceMeters,
        source: p.source,
        merchant: null,
        confidence: 0,
        suggestedCategoryHint: p.suggestedCategoryHint,
      });
      continue;
    }

    matches.push({
      detectedName: p.name,
      distanceMeters: p.distanceMeters,
      source: p.source,
      merchant: {
        id: best.merchant.id,
        displayName: best.merchant.displayName,
        mcc: best.merchant.mcc,
        categoryHint: best.merchant.categoryMappings[0]?.category ?? null,
      },
      confidence: best.score,
      suggestedCategoryHint: null,
    });
  }

  return NextResponse.json({
    nearby,
    matches,
    sources,
  });
}
