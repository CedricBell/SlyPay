import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { catalogProductAdminInclude } from "@/lib/credit-card-rules";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";
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
    prisma.cardCatalogProduct.findMany({
      skip,
      take,
      orderBy: [{ issuer: "asc" }, { name: "asc" }],
      include: catalogProductAdminInclude,
    }),
    prisma.cardCatalogProduct.count(),
  ]);

  const items = rows.map((product) => {
    const job = product.intelJobs[0] ?? null;
    const errSnippet = job?.errorMessage
      ? job.errorMessage.replace(/\s+/g, " ").slice(0, 120)
      : null;
    const previewRules = product.rewardRules.slice(0, 10);
    return {
      slug: product.slug,
      name: product.name,
      issuer: product.issuer,
      walletInstanceCount: product._count.creditCards,
      officialDocumentUrl: product.officialDocumentUrl,
      hasCatalogExtract: Boolean(product.lastExtractHash),
      catalogLastFetchedAt: product.lastFetchedAt?.toISOString() ?? null,
      rewardRuleCount: product.rewardRules.length,
      rulePreview: previewRules.map(
        (r) => `${r.category} ${dec(r.multiplier)}× (${r.earningType})`,
      ),
      uploadedDocument: product.uploadedDocument
        ? {
            byteSize: product.uploadedDocument.byteSize,
            fileName: product.uploadedDocument.fileName,
            uploadedAt: product.uploadedDocument.uploadedAt.toISOString(),
          }
        : null,
      latestIntelJob: job
        ? {
            status: job.status,
            createdAt: job.createdAt.toISOString(),
            finishedAt: job.finishedAt?.toISOString() ?? null,
            errorSnippet: errSnippet,
          }
        : null,
      updatedAt: product.updatedAt.toISOString(),
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
