import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Params) {
  const { slug } = await ctx.params;
  if (!slug?.trim()) {
    return NextResponse.json({ message: "Missing slug" }, { status: 400 });
  }

  const blob = await prisma.catalogDocumentBlob.findUnique({
    where: { productSlug: slug },
    select: {
      data: true,
      mimeType: true,
      fileName: true,
      byteSize: true,
    },
  });

  if (!blob) {
    return NextResponse.json({ message: "Document not found" }, { status: 404 });
  }

  const filename = blob.fileName?.replace(/[^\w.\- ]+/g, "_") || `${slug}.pdf`;

  return new NextResponse(Buffer.from(blob.data), {
    status: 200,
    headers: {
      "Content-Type": blob.mimeType || "application/pdf",
      "Content-Length": String(blob.byteSize),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
