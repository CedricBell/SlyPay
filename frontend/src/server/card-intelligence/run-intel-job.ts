import { prisma } from "@/lib/prisma";
import {
  applyCatalogRulesIfMissing,
  applyExtractSnapshotToCatalog,
  extractHasEarnRates,
} from "@/server/catalog-reward-rules";
import {
  discoverOfficialPdfUrl,
  inferIntelDocumentKindFromUrl,
  type IntelDocumentKind,
} from "@/server/card-intelligence/discover-official-pdf-url";
import { extractRewardsFromDocumentText } from "@/server/card-intelligence/extract-rewards";
import { loadCatalogDocumentText } from "@/server/catalog-document";
import { normalizeIntelDocumentFetchUrl } from "@/server/card-intelligence/intel-document-intent";
import { buildEditorialSupplementPlainText } from "@/server/card-intelligence/fetch-editorial-supplements";
import { recordKnownIssuerAfterPdfVerified } from "@/server/card-intelligence/known-issuer-registry";
import { resolveIntelIssuerAndCardName } from "@/server/catalog-infer";
import { buildRewardRuleDraftsFromExtract } from "@/server/card-intelligence/build-reward-rule-drafts";
import { parseRewardsExtract } from "@/server/card-intelligence/rewards-extract-schema";
import { refineIntelDocumentUrl } from "@/server/card-intelligence/resolve-intel-document";
import { probeIntelDocumentUrl } from "@/server/card-intelligence/intel-document-probe";
import { isAncillaryIssuerFeaturePath } from "@/server/card-intelligence/intel-path-bonus";
import {
  isGenericIssuerCardHub,
  isGenericIssuerDisclosureDocument,
  isIntelSourceCategoryHub,
  isIssuerApplyFormUrl,
  isThirdPartyIntelHost,
  normalizeIntelUrlForExclude,
} from "@/server/card-intelligence/intel-source-url-quality";
import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { upsertCatalogProductFromSlug } from "@/server/catalog-db-sync";
import { sha256Hex, stableSerialize } from "@/server/canonical-hash";

function catalogOfficialDocumentUrl(productSlug: string): string | null {
  return (
    CARD_CATALOG_ENTRIES.find((e) => e.id === productSlug)?.officialDocumentUrl ??
    null
  );
}

async function isAcceptableOfficialDocumentUrl(
  url: string,
): Promise<boolean> {
  if (
    isIntelSourceCategoryHub(url) ||
    isGenericIssuerCardHub(url) ||
    isGenericIssuerDisclosureDocument(url) ||
    isIssuerApplyFormUrl(url) ||
    isAncillaryIssuerFeaturePath(url)
  ) {
    return false;
  }
  try {
    if (isThirdPartyIntelHost(new URL(url).hostname)) return false;
  } catch {
    return false;
  }
  const probe = await probeIntelDocumentUrl(url);
  return probe.reachable || probe.status === 403;
}

function storedDocumentUrlIsObviouslyBad(
  url: string | null | undefined,
): boolean {
  if (!url?.trim()) return false;
  if (
    isIntelSourceCategoryHub(url) ||
    isGenericIssuerCardHub(url) ||
    isGenericIssuerDisclosureDocument(url) ||
    isIssuerApplyFormUrl(url) ||
    isAncillaryIssuerFeaturePath(url)
  ) {
    return true;
  }
  try {
    return isThirdPartyIntelHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function resolveDocumentUrl(args: {
  productSlug: string;
  officialDocumentUrl: string | null;
}): Promise<string | null> {
  const overrideSlug = process.env.CARD_INTEL_OVERRIDE_SLUG?.trim();
  const overrideUrl = process.env.CARD_INTEL_OVERRIDE_PDF_URL?.trim();
  if (
    overrideSlug &&
    overrideUrl &&
    overrideSlug === args.productSlug
  ) {
    return overrideUrl;
  }
  const candidates = [
    args.officialDocumentUrl,
    catalogOfficialDocumentUrl(args.productSlug),
  ].filter((u): u is string => Boolean(u?.trim()));

  for (const url of candidates) {
    if (storedDocumentUrlIsObviouslyBad(url)) continue;
    if (await isAcceptableOfficialDocumentUrl(url)) return url;
  }
  return null;
}

export async function runCardIntelJob(params: {
  productSlug: string;
  creditCardId?: string;
  /** Re-run LLM extraction even when a catalog snapshot already exists (e.g. admin PDF upload). */
  forceReanalyze?: boolean;
}) {
  const job = await prisma.cardIntelJob.create({
    data: {
      productSlug: params.productSlug,
      creditCardId: params.creditCardId,
      status: "PENDING",
    },
  });

  try {
    let forceReanalyze = params.forceReanalyze ?? false;

    await prisma.cardIntelJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    await upsertCatalogProductFromSlug(params.productSlug).catch(() => undefined);

    const product = await prisma.cardCatalogProduct.findUnique({
      where: { slug: params.productSlug },
    });
    if (!product) {
      throw new Error("Catalog product not found");
    }

    const existingRuleCount = await prisma.rewardRule.count({
      where: { catalogProductSlug: params.productSlug },
    });

    if (!forceReanalyze && product.lastExtractHash && existingRuleCount > 0) {
      await prisma.$transaction(async (tx) => {
        await applyCatalogRulesIfMissing(tx, params.productSlug);
      });
      await prisma.cardIntelJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          errorMessage: null,
        },
      });
      return;
    }

    if (
      !forceReanalyze &&
      product.lastExtractHash &&
      product.lastExtractJson &&
      existingRuleCount === 0
    ) {
      const applied = await prisma.$transaction(async (tx) => {
        return applyCatalogRulesIfMissing(tx, params.productSlug);
      });
      if (applied) {
        await prisma.cardIntelJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            finishedAt: new Date(),
            errorMessage: null,
          },
        });
        return;
      }
      if (!extractHasEarnRates(product.lastExtractJson)) {
        forceReanalyze = true;
      }
    }

    let url = await resolveDocumentUrl({
      productSlug: params.productSlug,
      officialDocumentUrl: product.officialDocumentUrl,
    });
    let sourceKind: IntelDocumentKind | null = null;
    const excludeDiscoveryUrls: string[] = [];

    if (
      product.officialDocumentUrl &&
      (storedDocumentUrlIsObviouslyBad(product.officialDocumentUrl) ||
        !(await isAcceptableOfficialDocumentUrl(product.officialDocumentUrl)))
    ) {
      if (product.officialDocumentUrl) {
        excludeDiscoveryUrls.push(
          normalizeIntelUrlForExclude(product.officialDocumentUrl),
        );
      }
      url = null;
      await prisma.cardCatalogProduct.update({
        where: { slug: product.slug },
        data: { officialDocumentUrl: null },
      });
    }

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
          excludeUrls: excludeDiscoveryUrls,
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
          const refined = await refineIntelDocumentUrl({
            url: discovered.url,
            issuer: issuerForJob,
            cardName: cardNameForJob,
            productSlug: product.slug,
          });
          const candidate = refined.url ?? discovered.url;
          if (await isAcceptableOfficialDocumentUrl(candidate)) {
            url = candidate;
            sourceKind = refined.sourceKind ?? discovered.sourceKind;
            await prisma.cardCatalogProduct.update({
              where: { slug: product.slug },
              data: { officialDocumentUrl: url },
            });
          }
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

    if (url) {
      const refined = await refineIntelDocumentUrl({
        url,
        issuer: issuerForJob,
        cardName: cardNameForJob,
        productSlug: product.slug,
      });
      if (
        refined.url &&
        refined.url !== url &&
        (await isAcceptableOfficialDocumentUrl(refined.url))
      ) {
        url = refined.url;
        sourceKind = refined.sourceKind;
        await prisma.cardCatalogProduct.update({
          where: { slug: product.slug },
          data: { officialDocumentUrl: refined.url },
        });
      }
    }

    if (url && !sourceKind) {
      sourceKind = await inferIntelDocumentKindFromUrl(url);
    }

    const hasUploadedBlob = await prisma.catalogDocumentBlob.findUnique({
      where: { productSlug: product.slug },
      select: { productSlug: true },
    });

    if (!url && hasUploadedBlob) {
      sourceKind = "pdf";
    }

    if (!url && !hasUploadedBlob) {
      const hasBrave =
        Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim()) ||
        Boolean(process.env.BRAVE_API_KEY?.trim());
      const hasGoogle =
        Boolean(process.env.GOOGLE_API_KEY?.trim()) &&
        Boolean(process.env.GOOGLE_CSE_ID?.trim());
      const hint = !hasBrave && !hasGoogle
        ? "Aucune source officielle trouvée — vérifiez BRAVE_SEARCH_API_KEY et/ou GOOGLE_API_KEY + GOOGLE_CSE_ID (recherche open-web activée par défaut), ou uploadez un PDF (admin)."
        : "Aucune page « rewards / rules » trouvée — uploadez un PDF (admin), vérifiez banque + nom de carte, ou renseignez officialDocumentUrl.";
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

    const fetchUrl = url ? normalizeIntelDocumentFetchUrl(url) : null;
    const { text, resolvedUrl } = await loadCatalogDocumentText({
      productSlug: product.slug,
      documentUrl: fetchUrl,
      sourceKind,
    });

    const supplemental = await buildEditorialSupplementPlainText(
      product.editorialSupplementUrls,
    );
    let documentText = text;
    if (supplemental) {
      documentText = `${documentText}\n\n===== SUPPLEMENTARY REFERENCE (THIRD-PARTY EDITORIAL — non-official; defer to issuer text above if anything conflicts) =====\n\n${supplemental}`;
    }

    const { issuerForRestOfJob } = await recordKnownIssuerAfterPdfVerified({
      documentUrl: resolvedUrl ?? url ?? product.officialDocumentUrl ?? "",
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

    const parsed = parseRewardsExtract(extracted);
    const sanitized = await buildRewardRuleDraftsFromExtract({
      productName: cardNameForJob,
      issuer: issuerForRestOfJob,
      extract: parsed,
    });

    if (!product.lastExtractHash || forceReanalyze) {
      await prisma.$transaction(async (tx) => {
        await tx.cardCatalogProduct.update({
          where: { slug: product.slug },
          data: {
            lastExtractHash: hash,
            lastExtractJson: extracted as object,
            lastFetchedAt: new Date(),
          },
        });
        await applyExtractSnapshotToCatalog(
          tx,
          product.slug,
          extracted,
          sanitized,
        );
      });
    } else if (product.lastExtractHash === hash) {
      await prisma.$transaction(async (tx) => {
        await tx.cardCatalogProduct.update({
          where: { slug: product.slug },
          data: { lastFetchedAt: new Date() },
        });
        await applyCatalogRulesIfMissing(tx, params.productSlug);
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

    let ruleCountAfter = await prisma.rewardRule.count({
      where: { catalogProductSlug: params.productSlug },
    });
    let jobStatus: "COMPLETED" | "FAILED" =
      ruleCountAfter > 0 || parsed.earnRates.length > 0 ? "COMPLETED" : "FAILED";
    let jobError: string | null =
      jobStatus === "COMPLETED"
        ? null
        : "Rewards document found but no earn rates could be mapped — try Retry rewards lookup.";

    const resolvedForRetry = resolvedUrl ?? url ?? null;
    if (
      jobStatus === "FAILED" &&
      resolvedForRetry &&
      !hasUploadedBlob &&
      excludeDiscoveryUrls.length < 2
    ) {
      excludeDiscoveryUrls.push(normalizeIntelUrlForExclude(resolvedForRetry));
      await prisma.cardCatalogProduct.update({
        where: { slug: product.slug },
        data: { officialDocumentUrl: null },
      });
      try {
        const rediscovered = await discoverOfficialPdfUrl({
          issuer: issuerForRestOfJob,
          cardName: cardNameForJob,
          productSlug: product.slug,
          excludeUrls: excludeDiscoveryUrls,
        });
        if (rediscovered.url && rediscovered.sourceKind) {
          const refined = await refineIntelDocumentUrl({
            url: rediscovered.url,
            issuer: issuerForRestOfJob,
            cardName: cardNameForJob,
            productSlug: product.slug,
          });
          const retryUrl = refined.url ?? rediscovered.url;
          if (await isAcceptableOfficialDocumentUrl(retryUrl)) {
            const retryKind = refined.sourceKind ?? rediscovered.sourceKind;
            const retryFetch = normalizeIntelDocumentFetchUrl(retryUrl);
            const retryLoaded = await loadCatalogDocumentText({
              productSlug: product.slug,
              documentUrl: retryFetch,
              sourceKind: retryKind,
            });
            const retryExtracted = await extractRewardsFromDocumentText({
              cardName: cardNameForJob,
              issuer: issuerForRestOfJob,
              documentText: retryLoaded.text,
            });
            const retryParsed = parseRewardsExtract(retryExtracted);
            const retrySanitized = await buildRewardRuleDraftsFromExtract({
              productName: cardNameForJob,
              issuer: issuerForRestOfJob,
              extract: retryParsed,
            });
            if (retryParsed.earnRates.length > 0) {
              const retryHash = sha256Hex(stableSerialize(retryExtracted));
              await prisma.$transaction(async (tx) => {
                await tx.cardCatalogProduct.update({
                  where: { slug: product.slug },
                  data: {
                    officialDocumentUrl: retryUrl,
                    lastExtractHash: retryHash,
                    lastExtractJson: retryExtracted as object,
                    lastFetchedAt: new Date(),
                  },
                });
                await applyExtractSnapshotToCatalog(
                  tx,
                  product.slug,
                  retryExtracted,
                  retrySanitized,
                );
              });
              ruleCountAfter = await prisma.rewardRule.count({
                where: { catalogProductSlug: params.productSlug },
              });
              jobStatus =
                ruleCountAfter > 0 || retryParsed.earnRates.length > 0
                  ? "COMPLETED"
                  : "FAILED";
              jobError =
                jobStatus === "COMPLETED"
                  ? null
                  : "Rewards document found but no earn rates could be mapped — try Retry rewards lookup.";
            }
          }
        }
      } catch {
        /* keep original failure */
      }
    }

    await prisma.cardIntelJob.update({
      where: { id: job.id },
      data: {
        status: jobStatus,
        finishedAt: new Date(),
        errorMessage: jobError,
      },
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
