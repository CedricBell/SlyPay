import { NextRequest, NextResponse } from "next/server";
import { CardWalletContributionStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const statusRaw = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const status =
    statusRaw === "ALL"
      ? undefined
      : (Object.values(CardWalletContributionStatus).includes(
            statusRaw as CardWalletContributionStatus,
          )
          ? (statusRaw as CardWalletContributionStatus)
          : CardWalletContributionStatus.PENDING);

  const pageRaw = req.nextUrl.searchParams.get("page");
  const p = pageRaw ? Number(pageRaw) : 1;
  const page = Math.max(Number.isFinite(p) ? p : 1, 1);
  const take = 50;
  const skip = (page - 1) * take;

  const where = status ? { status } : {};

  const [rows, total] = await Promise.all([
    prisma.cardWalletContribution.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        creditCard: {
          select: {
            id: true,
            name: true,
            issuer: true,
            catalogProductSlug: true,
          },
        },
        user: { select: { email: true } },
      },
    }),
    prisma.cardWalletContribution.count({ where }),
  ]);

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      body: r.body,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      card: r.creditCard,
      userEmail: r.user.email,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / take)),
  });
}
