import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Params) {
  const { slug: rawSlug } = await ctx.params;
  const slug = decodeURIComponent(rawSlug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ message: "Missing slug" }, { status: 400 });
  }

  const blob = await prisma.catalogCardImageBlob.findUnique({
    where: { productSlug: slug },
    select: {
      data: true,
      mimeType: true,
      byteSize: true,
      fetchedAt: true,
    },
  });

  if (!blob) {
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(blob.data), {
    status: 200,
    headers: {
      "Content-Type": blob.mimeType || "image/png",
      "Content-Length": String(blob.byteSize),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      ETag: `"${blob.fetchedAt.getTime()}-${blob.byteSize}"`,
      "Content-Disposition": `inline; filename="${slug.replace(/[^\w.\-]+/g, "_")}.png"`,
    },
  });
}
