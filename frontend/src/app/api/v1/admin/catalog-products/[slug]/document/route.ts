import { after, NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { catalogDocumentPublicUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { runCardIntelJob } from "@/server/card-intelligence/run-intel-job";
import { isPdfBytes } from "@/server/catalog-document";
import { resolveCatalogProductFromSlug } from "@/server/catalog-db-sync";

const MAX_BYTES = 15 * 1024 * 1024;

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { slug } = await ctx.params;
  if (!slug?.trim()) {
    return NextResponse.json({ message: "Missing slug" }, { status: 400 });
  }

  const product = await resolveCatalogProductFromSlug(slug);
  if (!product) {
    return NextResponse.json(
      { message: "Catalog product not found — pick a valid catalog slug." },
      { status: 404 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid multipart form" }, { status: 400 });
  }

  const file = form.get("document");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: 'Missing "document" file field' },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { message: `PDF must be between 1 byte and ${MAX_BYTES / (1024 * 1024)} MB` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!isPdfBytes(buf)) {
    return NextResponse.json(
      { message: "File does not look like a PDF (%PDF header missing)" },
      { status: 400 },
    );
  }

  const docUrl = catalogDocumentPublicUrl(slug);
  const fileName = file.name?.slice(0, 200) || `${slug}.pdf`;

  await prisma.$transaction(async (tx) => {
    await tx.catalogDocumentBlob.upsert({
      where: { productSlug: slug },
      create: {
        productSlug: slug,
        data: buf,
        byteSize: buf.byteLength,
        fileName,
        mimeType: file.type || "application/pdf",
        uploadedBy: auth.ctx.appUser.id,
      },
      update: {
        data: buf,
        byteSize: buf.byteLength,
        fileName,
        mimeType: file.type || "application/pdf",
        uploadedBy: auth.ctx.appUser.id,
        uploadedAt: new Date(),
      },
    });

    await tx.cardCatalogProduct.update({
      where: { slug },
      data: {
        officialDocumentUrl: docUrl,
        lastExtractHash: null,
        lastExtractJson: Prisma.JsonNull,
      },
    });
  });

  after(async () => {
    await runCardIntelJob({
      productSlug: slug,
      forceReanalyze: true,
    });
  });

  return NextResponse.json({
    ok: true,
    slug,
    officialDocumentUrl: docUrl,
    byteSize: buf.byteLength,
    intelQueued: true,
  });
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { slug } = await ctx.params;
  if (!slug?.trim()) {
    return NextResponse.json({ message: "Missing slug" }, { status: 400 });
  }

  await prisma.catalogDocumentBlob.deleteMany({ where: { productSlug: slug } });

  return NextResponse.json({ ok: true });
}
