import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";
import { computeWalletScore } from "@/lib/wallet-score";

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

  const [rows, total] = await Promise.all([
    prisma.creditCard.findMany({
      skip,
      take,
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, email: true } },
        _count: { select: { rewardRules: true } },
        rewardRules: {
          orderBy: [{ priority: "asc" }, { multiplier: "desc" }],
        },
        offers: true,
        catalogProduct: {
          select: {
            slug: true,
            name: true,
            officialDocumentUrl: true,
            lastExtractHash: true,
            lastExtractJson: true,
            lastFetchedAt: true,
            rotatingBonusCalendar: true,
          },
        },
        intelJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            createdAt: true,
            finishedAt: true,
            errorMessage: true,
          },
        },
      },
    }),
    prisma.creditCard.count(),
  ]);

  const items = rows.map((c) => {
    const cat = c.catalogProduct;
    const job = c.intelJobs[0] ?? null;
    const errSnippet = job?.errorMessage
      ? job.errorMessage.replace(/\s+/g, " ").slice(0, 120)
      : null;
    const extractJson =
      cat?.lastExtractJson != null ? cat.lastExtractJson : null;
    const calJson = cat?.rotatingBonusCalendar ?? null;
    const { total: walletScore, breakdown: walletScoreBreakdown } =
      computeWalletScore(c.rewardRules, extractJson, {
        cardId: c.id,
        cardName: c.name,
        issuer: c.issuer,
        offers: c.offers,
        rotatingBonusCalendar: calJson,
      });
    const previewRules = c.rewardRules.slice(0, 10);
    return {
      id: c.id,
      userId: c.userId,
      userEmail: c.user.email,
      name: c.name,
      issuer: c.issuer,
      last4: c.last4,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      catalogProductSlug: c.catalogProductSlug,
      catalogProductName: cat?.name ?? null,
      officialDocumentUrl: cat?.officialDocumentUrl ?? null,
      hasCatalogExtract: Boolean(cat?.lastExtractHash),
      catalogLastFetchedAt: cat?.lastFetchedAt?.toISOString() ?? null,
      rewardRuleCount: c._count.rewardRules,
      walletScore,
      walletScoreBreakdown,
      rulePreview: previewRules.map(
        (r) =>
          `${r.category} ${dec(r.multiplier)}× (${r.earningType})`,
      ),
      latestIntelJob: job
        ? {
            status: job.status,
            createdAt: job.createdAt.toISOString(),
            finishedAt: job.finishedAt?.toISOString() ?? null,
            errorSnippet: errSnippet,
          }
        : null,
    };
  });

  return NextResponse.json({
    items,
    total,
    page,
    limit: take,
    pages: Math.ceil(total / take) || 1,
  });
}
