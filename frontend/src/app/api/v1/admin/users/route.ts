import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const pageRaw = req.nextUrl.searchParams.get("page");
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const p = pageRaw ? Number(pageRaw) : 1;
  const l = limitRaw ? Number(limitRaw) : 50;
  const take = Math.min(Math.max(Number.isFinite(l) ? l : 50, 1), 100);
  const page = Math.max(Number.isFinite(p) ? p : 1, 1);
  const skip = (page - 1) * take;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { creditCards: true } },
      },
    }),
    prisma.user.count(),
  ]);

  return NextResponse.json({
    items: items.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      cardCount: u._count.creditCards,
    })),
    total,
    page,
    limit: take,
    pages: Math.ceil(total / take) || 1,
  });
}
