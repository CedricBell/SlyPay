import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { guessIssuerApexDomainsFromDisplayName } from "@/server/card-intelligence/issuer-domain-guess";
import { normalizeIssuer } from "@/server/card-intelligence/issuer-official-domains";

function slugTailAfterIssuerPrefix(productSlug: string, issuer: string): string | null {
  if (productSlug.startsWith("adhoc-")) return null;
  const parts = productSlug.split("-").filter((p) => p.length > 0);
  if (parts.length < 2) return null;

  const issuerKey = normalizeIssuer(issuer).replace(/\s+/g, "-");
  const issuerParts = issuerKey.split("-").filter(Boolean);

  let start = 0;
  if (issuerParts.length && parts.slice(0, issuerParts.length).join("-") === issuerParts.join("-")) {
    start = issuerParts.length;
  } else if (parts[0] === issuerParts[0] || parts[0] === normalizeIssuer(issuer).split(" ")[0]) {
    start = 1;
  } else {
    const entry = CARD_CATALOG_ENTRIES.find((e) => e.id === productSlug);
    if (entry) {
      const idParts = entry.id.split("-");
      start = idParts[0] === parts[0] ? 1 : 0;
    }
  }

  const tail = parts.slice(start);
  if (!tail.length) return null;
  return tail.join("/");
}

function slugifySegment(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Common marketing paths for fintech / unmapped issuers. */
function guessGenericProductPageUrls(
  issuer: string,
  cardName: string,
): string[] {
  const apexes = guessIssuerApexDomainsFromDisplayName(issuer);
  if (!apexes.length) return [];

  const cardSlug = slugifySegment(cardName);
  const issuerSlug = slugifySegment(normalizeIssuer(issuer).split(" ")[0] ?? "");
  const combined = slugifySegment(`${issuer} ${cardName}`);
  const slugs = [...new Set([cardSlug, combined, issuerSlug].filter((s) => s.length >= 2))];

  const pathTemplates = [
    "/credit-card",
    "/credit-cards",
    "/card",
    "/cards",
    "/us/en/credit-card",
    "/us/en/credit-cards",
  ];
  for (const slug of slugs) {
    pathTemplates.push(
      `/credit-card/${slug}`,
      `/credit-cards/${slug}`,
      `/card/${slug}`,
      `/cards/${slug}`,
      `/${slug}`,
    );
  }

  const urls: string[] = [];
  for (const apex of apexes) {
    for (const origin of [`https://www.${apex}`, `https://${apex}`]) {
      for (const path of pathTemplates) {
        urls.push(`${origin}${path}`);
      }
    }
  }
  return [...new Set(urls)];
}

/**
 * Direct product-page URLs (e.g. Chase Sapphire on creditcards.chase.com).
 */
export function guessIssuerProductPageUrls(
  issuer: string,
  productSlug: string,
  cardName?: string,
): string[] {
  const tail = slugTailAfterIssuerPrefix(productSlug, issuer);
  const key = normalizeIssuer(issuer);
  const urls: string[] = [];

  if (!tail) {
    if (cardName?.trim()) {
      urls.push(...guessGenericProductPageUrls(issuer, cardName));
    }
    return [...new Set(urls)];
  }

  if (key === "chase" || key.includes("chase")) {
    urls.push(
      `https://creditcards.chase.com/rewards-credit-cards/${tail}`,
      `https://creditcards.chase.com/cash-back-credit-cards/${tail}`,
      `https://creditcards.chase.com/aeroplan-credit-cards/${tail}`,
    );
  }

  if (key.includes("american express") || key === "amex") {
    const slugPath = tail.replace(/\//g, "-");
    urls.push(
      `https://www.americanexpress.com/en-us/credit-cards/card/${slugPath}/`,
      `https://www.americanexpress.com/us/credit-cards/card/${slugPath}/`,
    );
  }

  if (key.includes("discover")) {
    urls.push(`https://www.discover.com/credit-cards/${tail.replace(/\//g, "-")}/`);
  }

  if (key.includes("capital one")) {
    urls.push(
      `https://www.capitalone.com/credit-cards/${tail.replace(/\//g, "-")}/`,
    );
  }

  return [...new Set(urls)];
}
