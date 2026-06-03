import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const rows = await prisma.cardCatalogProduct.findMany({
    orderBy: [{ issuer: "asc" }, { name: "asc" }],
    take: 500,
    select: {
      slug: true,
      name: true,
      issuer: true,
      editorialSupplementUrls: true,
      officialDocumentUrl: true,
      lastExtractHash: true,
      lastFetchedAt: true,
      uploadedDocument: {
        select: {
          byteSize: true,
          fileName: true,
          uploadedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      issuer: r.issuer,
      editorialSupplementUrls: parseUrlJson(r.editorialSupplementUrls),
      officialDocumentUrl: r.officialDocumentUrl,
      hasCatalogExtract: Boolean(r.lastExtractHash),
      catalogLastFetchedAt: r.lastFetchedAt?.toISOString() ?? null,
      uploadedDocument: r.uploadedDocument
        ? {
            byteSize: r.uploadedDocument.byteSize,
            fileName: r.uploadedDocument.fileName,
            uploadedAt: r.uploadedDocument.uploadedAt.toISOString(),
          }
        : null,
    })),
  });
}

function parseUrlJson(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}
