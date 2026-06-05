import { prisma } from "@/lib/prisma";
import {
  detectCoBrandContext,
  isKnownBankIssuer,
  shouldPreserveBankIssuerFromRetailerPdf,
} from "@/server/card-intelligence/co-brand-discovery";
import { isPlaceholderIssuerForOpenSearch } from "@/server/card-intelligence/pdf-discovery-query";

/**
 * Registrable-style host key for deduping (subdomains → parent `*.x.com` → `x.com`).
 * Heuristic only; good enough for common issuer PDF hosts.
 */
export function hostKeyForKnownIssuer(hostname: string): string {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;
  return parts.slice(-2).join(".");
}

export function deriveIssuerDisplayNameFromHostAndCard(
  cardName: string,
  hostname: string,
): string {
  const apex = hostKeyForKnownIssuer(hostname);
  const words = cardName
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2);
  for (const w of words) {
    if (apex.includes(w)) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
  }
  const sld = apex.split(".")[0] ?? apex;
  if (sld.length >= 2) {
    return sld.charAt(0).toUpperCase() + sld.slice(1);
  }
  return cardName.trim().slice(0, 80) || "Issuer";
}

/**
 * After a PDF URL is validated (text extracted), register the issuer host + label
 * and replace placeholder issuers on the catalog product + linked wallet cards.
 */
export async function recordKnownIssuerAfterPdfVerified(args: {
  documentUrl: string;
  productSlug: string;
  productIssuer: string;
  productName: string;
}): Promise<{ issuerForRestOfJob: string }> {
  let hostname: string;
  try {
    hostname = new URL(args.documentUrl).hostname;
  } catch {
    return { issuerForRestOfJob: args.productIssuer };
  }

  const coBrand = detectCoBrandContext(args.productIssuer, args.productName);
  if (
    shouldPreserveBankIssuerFromRetailerPdf(
      args.productIssuer,
      hostname,
      coBrand,
    )
  ) {
    return { issuerForRestOfJob: args.productIssuer };
  }

  const apexDomain = hostKeyForKnownIssuer(hostname);
  const displayName = deriveIssuerDisplayNameFromHostAndCard(
    args.productName,
    hostname,
  );

  if (isKnownBankIssuer(args.productIssuer) && coBrand) {
    return { issuerForRestOfJob: args.productIssuer };
  }

  await prisma.knownIssuer.upsert({
    where: { apexDomain },
    create: { apexDomain, displayName },
    update: { displayName },
  });

  if (isPlaceholderIssuerForOpenSearch(args.productIssuer)) {
    await prisma.cardCatalogProduct.update({
      where: { slug: args.productSlug },
      data: { issuer: displayName },
    });
    await prisma.creditCard.updateMany({
      where: { catalogProductSlug: args.productSlug },
      data: { issuer: displayName },
    });
    return { issuerForRestOfJob: displayName };
  }

  return { issuerForRestOfJob: args.productIssuer };
}
