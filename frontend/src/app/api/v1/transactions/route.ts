import { SpendCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";

const createBody = z.object({
  amount: z.number().min(0.01),
  merchantId: z.string().optional(),
  category: z.nativeEnum(SpendCategory).optional(),
  mcc: z.string().max(8).optional(),
  note: z.string().max(500).optional(),
  currency: z.string().max(8).optional(),
});

function mapTx<T extends { amount: unknown }>(row: T) {
  return { ...row, amount: dec(row.amount) };
}

export async function GET(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const n = limitRaw ? Number(limitRaw) : 50;
  const take = Math.min(Number.isFinite(n) ? n : 50, 200);
  const rows = await prisma.transaction.findMany({
    where: { userId: ctx.appUser.id },
    orderBy: { createdAt: "desc" },
    take,
    include: { merchant: true },
  });
  return NextResponse.json(rows.map((r) => mapTx(r)));
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

  if (body.merchantId) {
    const m = await prisma.merchant.findUnique({
      where: { id: body.merchantId },
    });
    if (!m) {
      return NextResponse.json({ message: "Merchant not found" }, { status: 404 });
    }
  }

  const row = await prisma.transaction.create({
    data: {
      userId: ctx.appUser.id,
      amount: body.amount,
      merchantId: body.merchantId,
      category: body.category,
      mcc: body.mcc?.replace(/\D/g, "").slice(0, 4) || undefined,
      note: body.note,
      currency: body.currency ?? "USD",
    },
    include: { merchant: true },
  });

  return NextResponse.json(mapTx(row));
}
