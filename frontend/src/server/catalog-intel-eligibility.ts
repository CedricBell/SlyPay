import {
  inferIssuerAndProductNameDetailed,
  type CatalogInferMethod,
} from "@/server/catalog-infer";
import { searchCardCatalogScored } from "@/server/card-catalog-search";
import { isSafelistIssuer, findBestSafelistIssuerInText } from "@/server/issuer-safelist";
import { isTrustedIssuerQuery, resolveUserCardInput } from "@/server/wallet-card-resolve";

const AD_HOC_INFER_METHODS = new Set<CatalogInferMethod>([
  "prefix",
  "suffix",
  "catalog_embed",
  "unknown_brand",
]);

const MIN_CATALOG_MATCH_SCORE = 20;

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function issuerMatchesInferred(
  catalogIssuer: string,
  inferredIssuer: string,
): boolean {
  return normalizeKey(catalogIssuer) === normalizeKey(inferredIssuer);
}

/** Ad-hoc intel when issuer is on the trusted safelist or query matches catalog closely. */
export function isAdHocCatalogIntelEligible(rawQuery: string): boolean {
  if (isTrustedIssuerQuery(rawQuery)) return true;

  const q = rawQuery.trim();
  if (q.length < 3) return false;

  const detailed = inferIssuerAndProductNameDetailed(q);
  if (!detailed || !AD_HOC_INFER_METHODS.has(detailed.method)) return false;

  const scored = searchCardCatalogScored(q, 8);
  const relevant = scored.filter(
    (row) =>
      row.score >= MIN_CATALOG_MATCH_SCORE &&
      issuerMatchesInferred(row.entry.issuer, detailed.issuer),
  );
  return relevant.length > 0;
}

export type CatalogQueryAssessment = {
  eligible: boolean;
  issuer: string | null;
  name: string | null;
  trustedIssuer: boolean;
};

export function assessCatalogQuery(rawQuery: string): CatalogQueryAssessment {
  const resolved = resolveUserCardInput(rawQuery);
  if (!resolved) {
    return { eligible: false, issuer: null, name: null, trustedIssuer: false };
  }
  return {
    eligible: true,
    issuer: resolved.issuer,
    name: resolved.name,
    trustedIssuer: resolved.trustedIssuer,
  };
}

export function isKnownCatalogIssuer(issuer: string): boolean {
  return isSafelistIssuer(issuer) || findBestSafelistIssuerInText(issuer) !== null;
}
