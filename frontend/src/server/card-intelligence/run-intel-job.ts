import { prisma } from "@/lib/prisma";
import { replaceLinkedCardRewardRulesForCatalogSlug } from "@/server/card-intelligence/apply-catalog-proposal";
import { sha256Hex, stableSerialize } from "@/server/canonical-hash";
import {
  discoverOfficialPdfUrl,
  inferIntelDocumentKindFromUrl,
  type IntelDocumentKind,
} from "@/server/card-intelligence/discover-official-pdf-url";
import { extractRewardsFromDocumentText } from "@/server/card-intelligence/extract-rewards";
import {
  fetchHtmlDocument,
  fetchPdfBuffer,
} from "@/server/card-intelligence/fetch-document";
import { htmlDocumentToPlainText } from "@/server/card-intelligence/html-to-intel-text";
import { normalizeIntelDocumentFetchUrl } from "@/server/card-intelligence/intel-document-intent";
import { buildEditorialSupplementPlainText } from "@/server/card-intelligence/fetch-editorial-supplements";
import { recordKnownIssuerAfterPdfVerified } from "@/server/card-intelligence/known-issuer-registry";
import { resolveIntelIssuerAndCardName } from "@/server/catalog-infer";
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
    let sourceKind: IntelDocumentKind | null = null;

    let issuerForJob = product.issuer;
    let cardNameForJob = product.name;

    const preResolve = resolveIntelIssuerAndCardName(
      product.issuer,
      product.name,
    );
    if (preResolve.corrected) {
      issuerForJob = preResolve.issuer;
      cardNameForJob = preResolve.cardName;
      await prisma.cardCatalogProduct.update({
        where: { slug: product.slug },
        data: { issuer: issuerForJob, name: cardNameForJob },
      });
      await prisma.creditCard.updateMany({
        where: { catalogProductSlug: product.slug },
        data: { issuer: issuerForJob, name: cardNameForJob },
      });
    }

    if (!url) {
      try {
        const discovered = await discoverOfficialPdfUrl({
          issuer: issuerForJob,
          cardName: cardNameForJob,
          productSlug: product.slug,
        });
        if (discovered.resolvedIssuer && discovered.resolvedCardName) {
          issuerForJob = discovered.resolvedIssuer;
          cardNameForJob = discovered.resolvedCardName;
          if (
            discovered.resolvedIssuer !== product.issuer ||
            discovered.resolvedCardName !== product.name
          ) {
            await prisma.cardCatalogProduct.update({
              where: { slug: product.slug },
              data: {
                issuer: issuerForJob,
                name: cardNameForJob,
              },
            });
            await prisma.creditCard.updateMany({
              where: { catalogProductSlug: product.slug },
              data: { issuer: issuerForJob, name: cardNameForJob },
            });
          }
        }
        if (discovered.url && discovered.sourceKind) {
          url = discovered.url;
          sourceKind = discovered.sourceKind;
          await prisma.cardCatalogProduct.update({
            where: { slug: product.slug },
            data: { officialDocumentUrl: discovered.url },
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await prisma.cardIntelJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            errorMessage: `Issuer-site discovery failed: ${msg.slice(0, 4000)}`,
          },
        });
        return;
      }
    }

    if (url && !sourceKind) {
      sourceKind = await inferIntelDocumentKindFromUrl(url);
    }

    if (!url) {
      const hasBrave =
        Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim()) ||
        Boolean(process.env.BRAVE_API_KEY?.trim());
      const hasGoogle =
        Boolean(process.env.GOOGLE_API_KEY?.trim()) &&
        Boolean(process.env.GOOGLE_CSE_ID?.trim());
      const hint = !hasBrave && !hasGoogle
        ? "Aucune URL de document — ajoutez BRAVE_SEARCH_API_KEY (Brave Search API, quota gratuit), ou GOOGLE_API_KEY + GOOGLE_CSE_ID, ou officialDocumentUrl."
        : "Aucune page « rewards / rules » trouvée sur le site de la banque — vérifiez banque + nom de carte, ou renseignez officialDocumentUrl (admin). Pour réactiver la recherche site: via Google/Brave : INTEL_ALLOW_ISSUER_SITE_SEARCH=1.";
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

    const fetchUrl = normalizeIntelDocumentFetchUrl(url);
    const text =
      sourceKind === "html"
        ? htmlDocumentToPlainText(await fetchHtmlDocument(fetchUrl))
        : await pdfBufferToText(await fetchPdfBuffer(fetchUrl));
    if (!text?.trim()) {
      throw new Error("Could not extract text from document");
    }

    const supplemental = await buildEditorialSupplementPlainText(
      product.editorialSupplementUrls,
    );
    let documentText = text.trim();
    if (supplemental) {
      documentText = `${documentText}\n\n===== SUPPLEMENTARY REFERENCE (THIRD-PARTY EDITORIAL — non-official; defer to issuer text above if anything conflicts) =====\n\n${supplemental}`;
    }

    const { issuerForRestOfJob } = await recordKnownIssuerAfterPdfVerified({
      documentUrl: url,
      productSlug: product.slug,
      productIssuer: issuerForJob,
      productName: cardNameForJob,
    });

    const extracted = await extractRewardsFromDocumentText({
      cardName: cardNameForJob,
      issuer: issuerForRestOfJob,
      documentText,
    });

    const hash = sha256Hex(stableSerialize(extracted));

    if (!product.lastExtractHash) {
      const parsed = rewardsExtractSchema.parse(extracted);
      const drafts = await mapExtractToRewardRules({
        productName: cardNameForJob,
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
