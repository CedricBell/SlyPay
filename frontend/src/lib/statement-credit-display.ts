/** Shared formatting for statement credits from extract JSON or catalog benefits. */

export type StatementCreditFields = {
  description: string;
  amountText?: string | null;
  cadence?: string | null;
  merchantHint?: string | null;
  categoryHint?: string | null;
  enrollmentRequired?: boolean;
  notes?: string | null;
};

export type StatementCreditDisplay = {
  title: string;
  amountText: string | null;
  cadence: string | null;
  merchantHint: string | null;
  enrollmentRequired: boolean;
  detail: string | null;
};

const GENERIC_LABEL =
  /^(statement\s*credit|credit|benefit|annual\s*credit)$/i;

export function isGenericStatementCreditLabel(label: string): boolean {
  const t = label.trim();
  return !t || GENERIC_LABEL.test(t);
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

export function toStatementCreditDisplay(
  fields: StatementCreditFields,
): StatementCreditDisplay {
  const title = resolveStatementCreditTitle(fields);
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
    merchantHint: fields.merchantHint?.trim() ?? null,
    enrollmentRequired: Boolean(fields.enrollmentRequired),
    detail: detailParts.length ? detailParts.join(" · ") : null,
  };
}

/** One-line label for wallet stacks / compact lists. */
export function formatStatementCreditHint(fields: StatementCreditFields): string {
  const d = toStatementCreditDisplay(fields);
  const parts = [d.title];
  if (d.amountText) parts.push(d.amountText);
  if (d.cadence) parts.push(d.cadence);
  if (d.merchantHint && !d.title.toLowerCase().includes(d.merchantHint.toLowerCase())) {
    parts.push(`@${d.merchantHint}`);
  }
  return parts.join(" · ").slice(0, 200);
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
    const key = `${display.title}|${display.amountText}|${display.cadence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
    if (out.length >= limit) break;
  }
  return out;
}
