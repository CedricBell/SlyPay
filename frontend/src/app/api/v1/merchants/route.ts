import { MappingSource, SpendCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";
import { searchGooglePlacesText } from "@/server/google-places-client";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function merchantMatchesQuery(
  merchant: { displayName: string; normalized: string },
  queryRaw: string,
  queryCompact: string,
) {
  const displayLower = merchant.displayName.toLowerCase();
  const displayCompact = normalizeSearch(merchant.displayName);
  const normalizedCompact = normalizeSearch(merchant.normalized);
  return (
    displayLower.includes(queryRaw) ||
    merchant.normalized.includes(queryRaw) ||
    (queryCompact.length > 0 &&
      (displayCompact.includes(queryCompact) ||
        normalizedCompact.includes(queryCompact)))
  );
}

const createBody = z.object({
  displayName: z.string().min(2).max(200),
  mcc: z.string().max(4).optional(),
  notes: z.string().optional(),
  categories: z.array(z.object({ category: z.nativeEnum(SpendCategory) })).optional(),
});

function mapMerchant(m: {
  categoryMappings: { confidence: unknown }[];
  [k: string]: unknown;
}) {
  return {
    ...m,
    categoryMappings: m.categoryMappings.map((cm) => ({
      ...cm,
      confidence: dec(cm.confidence),
    })),
  };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const queryRaw = q.trim().toLowerCase();
  const queryCompact = normalizeSearch(q);
  if (!queryRaw && !queryCompact) {
    return NextResponse.json([]);
  }

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const locationBias =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;

  const take = 25;
  const prefix = queryCompact.slice(0, 4);
  const [rows, googleHits] = await Promise.all([
    prisma.merchant.findMany({
      where: {
        OR: [
          { normalized: { contains: queryRaw } },
          { displayName: { contains: q.trim(), mode: "insensitive" } },
          ...(prefix.length >= 3
            ? [{ displayName: { contains: prefix, mode: "insensitive" as const } }]
            : []),
        ],
      },
      take,
      orderBy: { displayName: "asc" },
      include: { categoryMappings: true },
    }),
    searchGooglePlacesText(q.trim(), locationBias),
  ]);

  const filtered = rows.filter((r) =>
    merchantMatchesQuery(r, queryRaw, queryCompact),
  );
  const dbNames = new Set(
    filtered.map((r) => normalizeSearch(r.displayName)),
  );

  const fromDb = filtered.map((r) => ({
    ...mapMerchant(r),
    source: "db" as const,
  }));

  const fromGoogle = googleHits
    .filter((g) => {
      const key = normalizeSearch(g.displayName);
      return key && !dbNames.has(key);
    })
    .slice(0, 12)
    .map((g) => ({
      id: `gplace:${g.placeId}`,
      slug: `gplace-${g.placeId.replace(/\//g, "-")}`,
      displayName: g.displayName,
      normalized: normalizeSearch(g.displayName),
      mcc: null,
      notes: g.formattedAddress ?? null,
      categoryMappings: [] as ReturnType<typeof mapMerchant>["categoryMappings"],
      source: "google" as const,
    }));

  return NextResponse.json([...fromDb, ...fromGoogle]);
}

export async function POST(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof createBody>;
  try {
    body = createBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof z.ZodError ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  const normalized = normalizeSearch(body.displayName.trim());
  const base = slugify(body.displayName);
  let slug = base;
  let suffix = 0;
  while (await prisma.merchant.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }

  const merchant = await prisma.$transaction(async (tx) => {
    const m = await tx.merchant.create({
      data: {
        slug,
        displayName: body.displayName.trim(),
        normalized,
        mcc: body.mcc,
        notes: body.notes,
      },
    });
    if (body.categories?.length) {
      await tx.merchantCategoryMapping.createMany({
        data: body.categories.map((c) => ({
          merchantId: m.id,
          category: c.category,
          source: MappingSource.MANUAL,
        })),
        skipDuplicates: true,
      });
    }
    return tx.merchant.findUniqueOrThrow({
      where: { id: m.id },
      include: { categoryMappings: true },
    });
  });

  return NextResponse.json(mapMerchant(merchant));
}
