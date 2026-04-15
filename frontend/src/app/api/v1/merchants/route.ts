import { MappingSource, SpendCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
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
  const n = q.trim().toLowerCase();
  if (!n) {
    return NextResponse.json([]);
  }
  const take = 25;
  const rows = await prisma.merchant.findMany({
    where: {
      OR: [
        { normalized: { contains: n } },
        { displayName: { contains: q.trim(), mode: "insensitive" } },
      ],
    },
    take,
    orderBy: { displayName: "asc" },
    include: { categoryMappings: true },
  });
  return NextResponse.json(rows.map((r) => mapMerchant(r)));
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

  const normalized = body.displayName.trim().toLowerCase();
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
