import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const n = limitRaw ? Number(limitRaw) : 30;
  const take = Math.min(Number.isFinite(n) ? n : 30, 100);
  const rows = await prisma.recommendation.findMany({
    where: { userId: ctx.appUser.id },
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      amount: dec(r.amount),
    })),
  );
}
