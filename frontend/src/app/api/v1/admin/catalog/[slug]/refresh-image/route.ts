import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { runCatalogImageJob } from "@/server/catalog-image-pipeline";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  const trimmed = slug.trim();
  if (!trimmed) {
    return NextResponse.json({ message: "Invalid slug" }, { status: 400 });
  }

  const product = await prisma.cardCatalogProduct.findUnique({
    where: { slug: trimmed },
    select: { slug: true, name: true, issuer: true },
  });
  if (!product) {
    return NextResponse.json({ message: "Catalog product not found" }, { status: 404 });
  }

  const result = await runCatalogImageJob({
    productSlug: product.slug,
    issuer: product.issuer,
    cardName: product.name,
    forceRefresh: true,
  });

  return NextResponse.json({
    ok: result.status === "COMPLETED",
    productSlug: trimmed,
    status: result.status,
    stage: result.stage,
    imageUrl: result.imageUrl,
    sourceUrl: result.sourceUrl,
    errorMessage: result.errorMessage ?? null,
  });
}
