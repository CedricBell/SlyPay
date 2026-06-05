import { CARD_CATALOG_ENTRIES } from "@/server/card-catalog.entries";
import { guessIssuerApexDomainsFromDisplayName } from "@/server/card-intelligence/issuer-domain-guess";
import { normalizeIssuer } from "@/server/card-intelligence/issuer-official-domains";

/** Optional slug tail overrides when marketing path ≠ catalog slug tail. */
const AMEX_PATH_ALIASES: Record<string, string[]> = {
  green: ["green", "green-card"],
  gold: ["gold-card", "gold"],
  platinum: ["platinum"],
};

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
    .replace(/[^a-z0-9+]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function amexPathSegments(productSlug: string, tail: string): string[] {
  const segments = new Set<string>();
  const entry = CARD_CATALOG_ENTRIES.find((e) => e.id === productSlug);
  if (entry?.officialDocumentUrl) {
    try {
      const m = new URL(entry.officialDocumentUrl).pathname.match(
        /\/card\/([^/]+)/i,
      );
      if (m?.[1]) segments.add(m[1]);
    } catch {
      /* */
    }
  }

  const tailKey = tail.replace(/\//g, "-");
  segments.add(tailKey);
  if (tailKey.endsWith("-card")) {
    segments.add(tailKey.replace(/-card$/, ""));
  } else {
    segments.add(`${tailKey}-card`);
  }

  for (const [key, aliases] of Object.entries(AMEX_PATH_ALIASES)) {
    if (tailKey === key || tailKey.includes(key)) {
      for (const a of aliases) segments.add(a);
    }
  }

  const lowerName = (entry?.name ?? "").toLowerCase();
  for (const [key, aliases] of Object.entries(AMEX_PATH_ALIASES)) {
    if (new RegExp(`\\b${key.replace(/-/g, "[\\s-]+")}\\b`).test(lowerName)) {
      for (const a of aliases) segments.add(a);
    }
  }

  return [...segments].filter(Boolean);
}

function amexUrlsForSegment(seg: string): string[] {
  return [
    `https://www.americanexpress.com/us/credit-cards/card/${seg}/`,
    `https://www.americanexpress.com/en-us/credit-cards/card/${seg}/`,
  ];
}

/** Reachability-checked candidates for Amex marketing pages. */
export function amexMarketingUrlCandidates(
  productSlug: string,
  cardName?: string,
): string[] {
  const issuer = "American Express";
  const tail = slugTailAfterIssuerPrefix(productSlug, issuer);
  const urls: string[] = [];
  if (tail) {
    for (const seg of amexPathSegments(productSlug, tail)) {
      urls.push(...amexUrlsForSegment(seg));
    }
  }
  if (cardName?.trim()) {
    urls.push(...guessAmexProductPageUrlsFromCardName(cardName));
  }
  return [...new Set(urls)];
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
    "/apple-card",
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

/** Marketing URLs from card name tokens (adhoc slugs, user-typed labels). */
export function guessAmexProductPageUrlsFromCardName(cardName: string): string[] {
  const lower = cardName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const urls: string[] = [];
  for (const [key, aliases] of Object.entries(AMEX_PATH_ALIASES)) {
    const token = key.replace(/-/g, "[\\s-]+");
    if (new RegExp(`\\b${token}\\b`).test(lower)) {
      for (const seg of aliases) {
        urls.push(...amexUrlsForSegment(seg));
      }
    }
  }
  if (/\bplatinum\b/.test(lower) && !urls.length) {
    urls.push(
      "https://www.americanexpress.com/us/credit-cards/card/platinum/",
    );
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

  const entry = CARD_CATALOG_ENTRIES.find((e) => e.id === productSlug);
  if (entry?.officialDocumentUrl) {
    urls.push(entry.officialDocumentUrl);
  }

  if (!tail) {
    if (cardName?.trim()) {
      if (key.includes("american express") || key === "amex") {
        urls.push(...guessAmexProductPageUrlsFromCardName(cardName));
      }
      urls.push(...guessGenericProductPageUrls(issuer, cardName));
    }
    return [...new Set(urls)];
  }

  const tailDash = tail.replace(/\//g, "-");

  if (key === "chase" || key.includes("chase")) {
    urls.push(
      `https://creditcards.chase.com/rewards-credit-cards/${tail}`,
      `https://creditcards.chase.com/cash-back-credit-cards/${tail}`,
      `https://creditcards.chase.com/aeroplan-credit-cards/${tail}`,
    );
  }

  if (key.includes("american express") || key === "amex") {
    for (const seg of amexPathSegments(productSlug, tail)) {
      urls.push(...amexUrlsForSegment(seg));
    }
    if (cardName?.trim()) {
      urls.push(...guessAmexProductPageUrlsFromCardName(cardName));
    }
  }

  if (key.includes("discover")) {
    urls.push(`https://www.discover.com/credit-cards/${tailDash}/`);
  }

  if (key.includes("capital one")) {
    const paths = [
      tailDash,
      `${tailDash}-credit-card`,
      tailDash.replace(/one$/, "one-credit-card"),
    ];
    for (const p of [...new Set(paths)]) {
      urls.push(
        `https://www.capitalone.com/credit-cards/${p}/`,
        `https://creditcards.capitalone.com/credit-cards/${p}/`,
      );
    }
  }

  if (key.includes("us bank") || key.includes("u s bank")) {
    const usbPaths = [
      tailDash,
      tailDash.replace(/cash-plus/, "cash-plus-visa-signature"),
      `cash-plus-visa-signature-credit-card`,
    ];
    for (const p of [...new Set(usbPaths)]) {
      urls.push(
        `https://www.usbank.com/credit-cards/${p}.html`,
        `https://www.usbank.com/credit-cards/${p}/`,
        `https://www.usbank.com/credit-cards/${p}-credit-card.html`,
      );
    }
  }

  if (cardName?.trim()) {
    urls.push(...guessGenericProductPageUrls(issuer, cardName));
  }

  return [...new Set(urls)];
}
