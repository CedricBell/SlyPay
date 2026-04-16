import { NextRequest, NextResponse } from "next/server";
import { SpendCategory } from "@prisma/client";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type NearbyPlace = {
  name: string;
  distanceMeters: number;
};

type NearbyMatch = {
  detectedName: string;
  distanceMeters: number;
  merchant: {
    id: string;
    displayName: string;
    mcc: string | null;
    categoryHint: SpendCategory | null;
  };
  confidence: number;
};

function buildOverpassQuery(lat: number, lng: number, radius = 250): string {
  return `
[out:json][timeout:8];
(
  node(around:${radius},${lat},${lng})["shop"~"supermarket|convenience|department_store|mall|chemist|health_food|bakery"];
  node(around:${radius},${lat},${lng})["amenity"~"pharmacy|fuel|restaurant|fast_food|cafe|bar"];
  way(around:${radius},${lat},${lng})["shop"~"supermarket|department_store|mall|chemist"];
  way(around:${radius},${lat},${lng})["amenity"~"pharmacy|fuel|restaurant|fast_food|cafe|bar"];
);
out center tags;
`;
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

async function fetchNearbyPlaces(lat: number, lng: number): Promise<NearbyPlace[]> {
  const query = buildOverpassQuery(lat, lng, 300);
  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
    cache: "no-store",
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    elements?: Array<{
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: { name?: string };
    }>;
  };
  const seen = new Set<string>();
  const list: NearbyPlace[] = [];
  for (const e of data.elements ?? []) {
    const name = e.tags?.name?.trim();
    if (!name) continue;
    const key = normalizeSearch(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const pLat = e.lat ?? e.center?.lat;
    const pLng = e.lon ?? e.center?.lon;
    if (typeof pLat !== "number" || typeof pLng !== "number") continue;
    list.push({
      name,
      distanceMeters: distanceMeters(lat, lng, pLat, pLng),
    });
  }
  return list.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 12);
}

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

  const nearby = await fetchNearbyPlaces(lat, lng);
  if (nearby.length === 0) {
    return NextResponse.json({ nearby: [], matches: [] });
  }

  const dbMerchants = await prisma.merchant.findMany({
    where: {
      OR: nearby.flatMap((p) => {
        const n = normalizeSearch(p.name);
        const loose = p.name.toLowerCase().trim();
        return [
          { normalized: { contains: n } },
          { displayName: { contains: loose, mode: "insensitive" } },
        ];
      }),
    },
    include: { categoryMappings: true },
    take: 30,
  });

  const matches: NearbyMatch[] = [];
  for (const p of nearby) {
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
    if (!best) continue;
    matches.push({
      detectedName: p.name,
      distanceMeters: p.distanceMeters,
      merchant: {
        id: best.merchant.id,
        displayName: best.merchant.displayName,
        mcc: best.merchant.mcc,
        categoryHint: best.merchant.categoryMappings[0]?.category ?? null,
      },
      confidence: best.score,
    });
    if (matches.length >= 5) break;
  }

  return NextResponse.json({
    nearby,
    matches,
  });
}

