import { prisma } from "@/lib/prisma";
import {
  fetchHtmlDocument,
  fetchPdfBuffer,
} from "@/server/card-intelligence/fetch-document";
import type { IntelDocumentKind } from "@/server/card-intelligence/discover-official-pdf-url";

const MAX_BYTES = 15 * 1024 * 1024;

export async function loadCatalogDocumentText(args: {
  productSlug: string;
  documentUrl: string | null;
  sourceKind: IntelDocumentKind | null;
}): Promise<{ text: string; resolvedUrl: string | null }> {
  const blob = await prisma.catalogDocumentBlob.findUnique({
    where: { productSlug: args.productSlug },
    select: { data: true, mimeType: true, byteSize: true },
  });

  if (blob) {
    if (blob.byteSize > MAX_BYTES) {
      throw new Error("Uploaded document exceeds maximum size");
    }
    const { pdfBufferToText } = await import(
      "@/server/card-intelligence/pdf-text"
    );
    const buffer = Buffer.from(blob.data);
    const text = await pdfBufferToText(buffer);
    if (!text?.trim()) {
      throw new Error("Could not extract text from uploaded PDF");
    }
    return { text: text.trim(), resolvedUrl: null };
  }

  if (!args.documentUrl) {
    throw new Error("No document URL or uploaded PDF");
  }

  const fetchUrl = args.documentUrl;
  const text =
    args.sourceKind === "html"
      ? (await import("@/server/card-intelligence/html-to-intel-text")).htmlDocumentToPlainText(
          await fetchHtmlDocument(fetchUrl),
        )
      : await (
          await import("@/server/card-intelligence/pdf-text")
        ).pdfBufferToText(await fetchPdfBuffer(fetchUrl));

  if (!text?.trim()) {
    throw new Error("Could not extract text from document");
  }

  return { text: text.trim(), resolvedUrl: fetchUrl };
}

export function isPdfBytes(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "%PDF";
}
