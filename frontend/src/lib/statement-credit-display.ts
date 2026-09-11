/** Shared formatting for statement credits from extract JSON or catalog benefits. */

export type StatementCreditFields = {
  description: string;
  amountText?: string | null;
  cadence?: string | null;
  annualCapText?: string | null;
  merchantHint?: string | null;
  categoryHint?: string | null;
  enrollmentRequired?: boolean;
  notes?: string | null;
};

export type StatementCreditDisplay = {
  title: string;
  amountText: string | null;
  cadence: string | null;
  /** Human-readable amount + period (e.g. "Up to $100/quarter ($400/year)"). */
  amountSummary: string | null;
  merchantHint: string | null;
  enrollmentRequired: boolean;
  detail: string | null;
};

const GENERIC_LABEL =
  /^(statement\s*credit|credit|benefit|annual\s*credit)$/i;

type CadenceKind = "quarterly" | "monthly" | "annual" | "semiannual" | null;

export function isGenericStatementCreditLabel(label: string): boolean {
  const t = label.trim();
  return !t || GENERIC_LABEL.test(t);
}

function parseUsd(text: string): number | null {
  const m = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function classifyCadence(cadence: string | null | undefined): CadenceKind {
  if (!cadence?.trim()) return null;
  const c = cadence.toLowerCase();
  if (/quarter|each quarter|per quarter|\/\s*q\b/.test(c)) return "quarterly";
  if (/month|each month|per month|\/\s*m\b/.test(c)) return "monthly";
  if (/semi[- ]?annual|twice per year|every 6 months/.test(c)) return "semiannual";
  if (/year|annual|calendar year|per year|\/\s*y\b/.test(c)) return "annual";
  return null;
}

function formatPerPeriodPhrase(amountText: string, cadence: string): string {
  const amount = parseUsd(amountText);
  const kind = classifyCadence(cadence);
  if (amount != null && kind === "quarterly") return `$${formatMoney(amount)}/quarter`;
  if (amount != null && kind === "monthly") return `$${formatMoney(amount)}/month`;
  if (amount != null && kind === "annual") return `$${formatMoney(amount)}/year`;
  if (amount != null && kind === "semiannual") {
    return `$${formatMoney(amount)} every 6 months`;
  }
  return `${amountText} · ${cadence}`;
}

/** Prefer merchant / category / amount context when the model only says "Statement credit". */
export function resolveStatementCreditTitle(
  fields: StatementCreditFields,
): string {
  const raw = fields.description?.trim() ?? "";
  if (!isGenericStatementCreditLabel(raw)) return raw;

  const merchant = fields.merchantHint?.trim();
  if (merchant) {
    return /\bcredit\b/i.test(merchant) ? merchant : `${merchant} credit`;
  }

  const category = fields.categoryHint?.trim();
  if (category) {
    return /\bcredit\b/i.test(category)
      ? category
      : `${category} statement credit`;
  }

  const amount = fields.amountText?.trim();
  if (amount) return `Statement credit (${amount})`;

  return "Statement credit (see issuer terms)";
}

export function formatStatementCreditAmountSummary(
  amountText: string | null | undefined,
  cadence: string | null | undefined,
  annualCapText?: string | null,
): string | null {
  const amountRaw = amountText?.trim() ?? "";
  const cadenceRaw = cadence?.trim() ?? "";
  const capRaw = annualCapText?.trim() ?? "";

  if (!amountRaw && !cadenceRaw && !capRaw) return null;

  if (capRaw) {
    if (amountRaw && cadenceRaw) {
      const period = formatPerPeriodPhrase(amountRaw, cadenceRaw);
      const capNorm = /year|annual/i.test(capRaw)
        ? capRaw
        : `${capRaw}${/\//.test(capRaw) ? "" : "/year"}`;
      return `Up to ${period} (${capNorm})`;
    }
    return capRaw;
  }

  const amount = amountRaw ? parseUsd(amountRaw) : null;
  const kind = classifyCadence(cadenceRaw);

  if (amount != null && kind === "quarterly") {
    // Annual total stored with quarterly cadence (e.g. Resy $400/year as $400 · quarterly).
    if (amount >= 200 && amount % 4 === 0 && amount <= 2_000) {
      const perQuarter = amount / 4;
      return `Up to $${formatMoney(perQuarter)}/quarter ($${formatMoney(amount)}/year)`;
    }
    if (amount >= 10 && amount <= 250) {
      return `Up to $${formatMoney(amount)}/quarter ($${formatMoney(amount * 4)}/year max)`;
    }
  }

  if (amount != null && kind === "monthly") {
    // Annual membership credits mis-tagged as monthly (e.g. Walmart+ $155/year).
    if (amount >= 90 && amount <= 250) {
      return `$${formatMoney(amount)}/year`;
    }
    if (amount > 0 && amount < 90) {
      return `Up to $${formatMoney(amount)}/month`;
    }
  }

  if (amount != null && kind === "annual") {
    return `$${formatMoney(amount)}/year`;
  }

  if (amount != null && kind === "semiannual") {
    return `Up to $${formatMoney(amount)} every 6 months ($${formatMoney(amount * 2)}/year max)`;
  }

  const parts = [amountRaw, cadenceRaw].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function toStatementCreditDisplay(
  fields: StatementCreditFields,
): StatementCreditDisplay {
  const title = resolveStatementCreditTitle(fields);
  const amountSummary = formatStatementCreditAmountSummary(
    fields.amountText,
    fields.cadence,
    fields.annualCapText,
  );
  const detailParts: string[] = [];
  if (
    fields.description?.trim() &&
    !isGenericStatementCreditLabel(fields.description) &&
    fields.description.trim() !== title
  ) {
    detailParts.push(fields.description.trim());
  }
  if (fields.notes?.trim()) detailParts.push(fields.notes.trim());
  if (fields.enrollmentRequired) {
    detailParts.push("Enrollment required");
  }

  return {
    title,
    amountText: fields.amountText?.trim() ?? null,
    cadence: fields.cadence?.trim() ?? null,
    amountSummary,
    merchantHint: fields.merchantHint?.trim() ?? null,
    enrollmentRequired: Boolean(fields.enrollmentRequired),
    detail: detailParts.length ? detailParts.join(" · ") : null,
  };
}

export function formatStatementCreditLineFromDisplay(
  display: StatementCreditDisplay,
): string {
  const parts = [display.title, display.amountSummary].filter(Boolean);
  return parts.join(" · ").slice(0, 240);
}

/** One-line label for wallet stacks / compact lists. */
export function formatStatementCreditHint(fields: StatementCreditFields): string {
  return formatStatementCreditLineFromDisplay(toStatementCreditDisplay(fields));
}

export function statementCreditsFromExtractJson(
  json: unknown,
  limit = 12,
): StatementCreditDisplay[] {
  if (!json || typeof json !== "object") return [];
  const sc = (json as { statementCredits?: unknown }).statementCredits;
  if (!Array.isArray(sc)) return [];

  const out: StatementCreditDisplay[] = [];
  const seen = new Set<string>();

  for (const item of sc) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const fields: StatementCreditFields = {
      description: String(row.description ?? row.title ?? row.name ?? ""),
      amountText:
        row.amountText != null
          ? String(row.amountText)
          : row.amount != null
            ? String(row.amount)
            : null,
      cadence:
        row.cadence != null
          ? String(row.cadence)
          : row.frequency != null
            ? String(row.frequency)
            : null,
      annualCapText:
        row.annualCapText != null
          ? String(row.annualCapText)
          : row.annualCap != null
            ? String(row.annualCap)
            : null,
      merchantHint:
        row.merchantHint != null
          ? String(row.merchantHint)
          : row.merchant != null
            ? String(row.merchant)
            : null,
      categoryHint:
        row.categoryHint != null
          ? String(row.categoryHint)
          : row.category != null
            ? String(row.category)
            : null,
      enrollmentRequired:
        typeof row.enrollmentRequired === "boolean"
          ? row.enrollmentRequired
          : undefined,
      notes: row.notes != null ? String(row.notes) : null,
    };
    const display = toStatementCreditDisplay(fields);
    const key = `${display.title}|${display.amountSummary}|${display.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
    if (out.length >= limit) break;
  }
  return out;
}
