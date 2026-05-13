import { prisma } from "@/lib/prisma";
import { replaceLinkedCardRewardRulesForCatalogSlug } from "@/server/card-intelligence/apply-catalog-proposal";
import { sha256Hex, stableSerialize } from "@/server/canonical-hash";
import { discoverOfficialPdfUrl } from "@/server/card-intelligence/discover-official-pdf-url";
import { extractRewardsFromDocumentText } from "@/server/card-intelligence/extract-rewards";
import { fetchPdfBuffer } from "@/server/card-intelligence/fetch-document";
import { recordKnownIssuerAfterPdfVerified } from "@/server/card-intelligence/known-issuer-registry";
import { mapExtractToRewardRules } from "@/server/card-intelligence/map-extract-to-reward-rules";
import { rewardsExtractSchema } from "@/server/card-intelligence/rewards-extract-schema";
import { pdfBufferToText } from "@/server/card-intelligence/pdf-text";
import { sanitizeRewardRuleDrafts } from "@/server/reward-rules-sanitize";

function resolveDocumentUrl(args: {
  productSlug: string;
  officialDocumentUrl: string | null;
}): string | null {
  const overrideSlug = process.env.CARD_INTEL_OVERRIDE_SLUG?.trim();
  const overrideUrl = process.env.CARD_INTEL_OVERRIDE_PDF_URL?.trim();
  if (
    overrideSlug &&
    overrideUrl &&
    overrideSlug === args.productSlug
  ) {
    return overrideUrl;
  }
  return args.officialDocumentUrl;
}

export async function runCardIntelJob(params: {
  productSlug: string;
  creditCardId?: string;
}) {
  const job = await prisma.cardIntelJob.create({
    data: {
      productSlug: params.productSlug,
      creditCardId: params.creditCardId,
      status: "PENDING",
    },
  });

  try {
    await prisma.cardIntelJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const product = await prisma.cardCatalogProduct.findUnique({
      where: { slug: params.productSlug },
    });
    if (!product) {
      throw new Error("Catalog product not found");
    }

    let url = resolveDocumentUrl({
      productSlug: params.productSlug,
      officialDocumentUrl: product.officialDocumentUrl,
    });

    if (!url) {
      try {
        const { url: discovered } = await discoverOfficialPdfUrl({
          issuer: product.issuer,
          cardName: product.name,
          productSlug: product.slug,
        });
        if (discovered) {
          url = discovered;
          await prisma.cardCatalogProduct.update({
            where: { slug: product.slug },
            data: { officialDocumentUrl: discovered },
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await prisma.cardIntelJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            errorMessage: `PDF discovery failed: ${msg.slice(0, 4000)}`,
          },
        });
        return;
      }
    }

    if (!url) {
      const hasBrave =
        Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim()) ||
        Boolean(process.env.BRAVE_API_KEY?.trim());
      const hasGoogle =
        Boolean(process.env.GOOGLE_API_KEY?.trim()) &&
        Boolean(process.env.GOOGLE_CSE_ID?.trim());
      const hint = !hasBrave && !hasGoogle
        ? "Aucune URL PDF — ajoutez BRAVE_SEARCH_API_KEY (Brave Search API, quota gratuit), ou GOOGLE_API_KEY + GOOGLE_CSE_ID, ou officialDocumentUrl."
        : "Aucun PDF trouvé (domaines officiels ou recherche web ouverte) — vérifiez le nom et l'émetteur, ou renseignez officialDocumentUrl.";
      await prisma.cardIntelJob.update({
        where: { id: job.id },
        data: {
          status: "SKIPPED_NO_SOURCE",
          finishedAt: new Date(),
          errorMessage: hint,
        },
      });
      return;
    }

    const pdfBuf = await fetchPdfBuffer(url);
    const text = await pdfBufferToText(pdfBuf);
    if (!text) {
      throw new Error("Could not extract text from PDF");
    }

    const { issuerForRestOfJob } = await recordKnownIssuerAfterPdfVerified({
      documentUrl: url,
      productSlug: product.slug,
      productIssuer: product.issuer,
      productName: product.name,
    });

    const extracted = await extractRewardsFromDocumentText({
      cardName: product.name,
      issuer: issuerForRestOfJob,
      documentText: text,
    });

    const hash = sha256Hex(stableSerialize(extracted));

    if (!product.lastExtractHash) {
      const parsed = rewardsExtractSchema.parse(extracted);
      const drafts = await mapExtractToRewardRules({
        productName: product.name,
        issuer: issuerForRestOfJob,
        extract: parsed,
      });
      const sanitized = sanitizeRewardRuleDrafts(drafts);
      await prisma.$transaction(async (tx) => {
        await tx.cardCatalogProduct.update({
          where: { slug: product.slug },
          data: {
            lastExtractHash: hash,
            lastExtractJson: extracted as object,
            lastFetchedAt: new Date(),
          },
        });
        await replaceLinkedCardRewardRulesForCatalogSlug(
          tx,
          product.slug,
          sanitized,
        );
      });
    } else if (product.lastExtractHash === hash) {
      await prisma.cardCatalogProduct.update({
        where: { slug: product.slug },
        data: { lastFetchedAt: new Date() },
      });
    } else {
      await prisma.cardCatalogExtractProposal.create({
        data: {
          productSlug: product.slug,
          previousHash: product.lastExtractHash,
          proposedHash: hash,
          proposedPayload: extracted as object,
          status: "PENDING",
        },
      });
      await prisma.cardCatalogProduct.update({
        where: { slug: product.slug },
        data: { lastFetchedAt: new Date() },
      });
    }

    await prisma.cardIntelJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", finishedAt: new Date() },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.cardIntelJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: msg.slice(0, 8000),
      },
    });
  }
}
