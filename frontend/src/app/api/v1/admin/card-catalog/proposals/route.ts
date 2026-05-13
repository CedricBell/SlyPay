import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const rows = await prisma.cardCatalogExtractProposal.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          slug: true,
          name: true,
          issuer: true,
          lastExtractHash: true,
          officialDocumentUrl: true,
        },
      },
    },
    take: 100,
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      productSlug: r.productSlug,
      previousHash: r.previousHash,
      proposedHash: r.proposedHash,
      proposedPayload: r.proposedPayload,
      createdAt: r.createdAt.toISOString(),
      product: r.product,
    })),
  });
}
