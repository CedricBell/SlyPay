"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CardCatalogSuggest,
  type CatalogTemplate,
} from "@/components/CardCatalogSuggest";
import { CardThumbnail } from "@/components/CardThumbnail";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";

const CATEGORIES = [
  "GROCERIES",
  "DINING",
  "TRAVEL",
  "GAS",
  "ONLINE_SHOPPING",
  "DRUGSTORES",
  "ENTERTAINMENT",
  "WHOLESALE",
  "OTHER",
] as const;

const EARN = ["POINTS", "MILES", "CASHBACK_PERCENT"] as const;

type RuleRow = {
  id?: string;
  category: (typeof CATEGORIES)[number];
  multiplier: string;
  earningType: (typeof EARN)[number];
};

type WalletPreview = {
  ruleHighlights: string[];
  pdfSummary: string | null;
  statementCreditHints: string[];
  scoreBreakdown?: {
    statementCredits: number;
    earnStructure: number;
    rewardRules: number;
    annualFeePenalty?: number;
  };
};

type CardDetail = {
  id: string;
  name: string;
  issuer: string;
  last4: string | null;
  colorHex: string | null;
  isActive: boolean;
  rewardRules: Array<{
    category: string;
    multiplier: number;
    earningType: string;
  }>;
  catalogLinked?: boolean;
  catalogSlug?: string | null;
  hasOfficialPdfExtract?: boolean;
  officialDocumentUrl?: string | null;
  walletPreview?: WalletPreview;
  walletScore?: number;
};

export default function EditCardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [last4, setLast4] = useState("");
  const [colorHex, setColorHex] = useState("#0f172a");
  const [isActive, setIsActive] = useState(true);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [intel, setIntel] = useState<{
    catalogSlug: string | null;
    officialDocumentUrl: string | null;
    hasOfficialPdfExtract: boolean;
    walletPreview: WalletPreview | undefined;
    walletScore: number | undefined;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [init, setInit] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiFetch<CardDetail>(`/cards/${id}`);
        setName(c.name);
        setIssuer(c.issuer);
        setLast4(c.last4 ?? "");
        setColorHex(c.colorHex ?? "#0f172a");
        setIsActive(c.isActive);
        setRules(
          c.rewardRules.map((r) => ({
            category: r.category as RuleRow["category"],
            multiplier: String(r.multiplier),
            earningType: r.earningType as RuleRow["earningType"],
          })),
        );
        setIntel({
          catalogSlug: c.catalogSlug ?? null,
          officialDocumentUrl: c.officialDocumentUrl ?? null,
          hasOfficialPdfExtract: Boolean(c.hasOfficialPdfExtract),
          walletPreview: c.walletPreview,
          walletScore: c.walletScore,
        });
        setInit(true);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setErr("Could not load card");
      }
    })();
  }, [id, router]);

  const addRule = () => {
    setRules((r) => [
      ...r,
      { category: "OTHER", multiplier: "1", earningType: "POINTS" },
    ]);
  };

  const applyCatalog = (t: CatalogTemplate) => {
    setName(t.name);
    setIssuer(t.issuer);
    if (t.colorHex) setColorHex(t.colorHex);
    setRules(
      t.rules.map((r) => ({
        category: r.category as RuleRow["category"],
        multiplier: String(r.multiplier),
        earningType: r.earningType as RuleRow["earningType"],
      })),
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await apiFetch(`/cards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          issuer,
          last4: last4 || undefined,
          colorHex,
          isActive,
          rules: rules.map((x) => ({
            category: x.category,
            multiplier: Number(x.multiplier),
            earningType: x.earningType,
          })),
        }),
      });
      router.push("/cards");
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this card?")) return;
    setLoading(true);
    try {
      await apiFetch(`/cards/${id}`, { method: "DELETE" });
      router.push("/cards");
    } catch {
      setErr("Delete failed");
    } finally {
      setLoading(false);
    }
  };

  if (!init && !err) {
    return <p className="text-zinc-500">Loading…</p>;
  }
  if (err && !init) {
    return <p className="text-red-600">{err}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit card</h1>
      <div className="flex justify-center rounded-2xl border border-zinc-200/70 bg-zinc-50/80 py-6 dark:border-zinc-800 dark:bg-zinc-950/40">
        <CardThumbnail
          name={name || "Card"}
          issuer={issuer || "Issuer"}
          last4={last4 || null}
          colorHex={colorHex}
          size="lg"
        />
      </div>
      <form onSubmit={save} className="space-y-4">
        <CardCatalogSuggest onApply={applyCatalog} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Issuer</label>
            <input
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Last 4</label>
            <input
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              value={last4}
              maxLength={4}
              onChange={(e) => setLast4(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Accent color</label>
            <input
              type="color"
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white dark:border-zinc-700"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (inactive cards are ignored by the engine)
        </label>

        {intel &&
          (intel.catalogSlug ||
            intel.officialDocumentUrl ||
            intel.hasOfficialPdfExtract) && (
            <div className="space-y-3 rounded-xl border border-violet-200/80 bg-violet-50/50 p-4 text-sm dark:border-violet-900/50 dark:bg-violet-950/20">
              <p className="font-semibold text-violet-900 dark:text-violet-200">
                Catalog &amp; PDF intelligence
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                <strong>Admin</strong> only lists items when a{" "}
                <em>new</em> PDF changes the stored extract hash. On the{" "}
                <em>first</em> successful run, rules below are applied
                automatically — nothing to approve there.
              </p>
              {intel.catalogSlug && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Catalog slug:{" "}
                  <code className="rounded bg-white px-1 py-0.5 font-mono dark:bg-zinc-900">
                    {intel.catalogSlug}
                  </code>
                  {intel.walletScore != null && (
                    <span className="ml-2">
                      · Wallet score:{" "}
                      <strong>{Math.round(intel.walletScore)}</strong>
                      {intel.walletPreview?.scoreBreakdown && (
                        <span className="text-zinc-500">
                          {" "}
                          (credits {intel.walletPreview.scoreBreakdown.statementCredits}
                          , earn {intel.walletPreview.scoreBreakdown.earnStructure}, rules{" "}
                          {intel.walletPreview.scoreBreakdown.rewardRules}
                          {intel.walletPreview.scoreBreakdown.annualFeePenalty
                            ? `, annual fee ${intel.walletPreview.scoreBreakdown.annualFeePenalty}`
                            : ""}
                          )
                        </span>
                      )}
                    </span>
                  )}
                </p>
              )}
              {intel.officialDocumentUrl ? (
                <a
                  href={intel.officialDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex font-medium text-violet-700 underline dark:text-violet-400"
                >
                  Open official PDF (new tab)
                </a>
              ) : (
                <p className="text-xs text-amber-800 dark:text-amber-200/90">
                  No PDF URL on the catalog row yet (discovery may still be
                  running or failed).
                </p>
              )}
              {intel.walletPreview?.pdfSummary && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Extract summary
                  </p>
                  <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                    {intel.walletPreview.pdfSummary}
                  </p>
                </div>
              )}
              {intel.walletPreview &&
                intel.walletPreview.statementCreditHints.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Statement credits (from PDF)
                    </p>
                    <ul className="mt-1 list-inside list-disc text-zinc-700 dark:text-zinc-300">
                      {intel.walletPreview.statementCreditHints.map((t, idx) => (
                        <li key={`${idx}-${t.slice(0, 48)}`}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Reward rules</p>
            <button
              type="button"
              onClick={addRule}
              className="text-sm font-medium text-violet-600"
            >
              + Add rule
            </button>
          </div>
          {rules.map((r, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-zinc-200 p-3 sm:grid-cols-3 dark:border-zinc-800"
            >
              <select
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={r.category}
                onChange={(e) => {
                  const v = e.target.value as RuleRow["category"];
                  setRules((x) =>
                    x.map((row, j) => (j === i ? { ...row, category: v } : row)),
                  );
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                min="0"
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={r.multiplier}
                onChange={(e) => {
                  const v = e.target.value;
                  setRules((x) =>
                    x.map((row, j) => (j === i ? { ...row, multiplier: v } : row)),
                  );
                }}
              />
              <select
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={r.earningType}
                onChange={(e) => {
                  const v = e.target.value as RuleRow["earningType"];
                  setRules((x) =>
                    x.map((row, j) =>
                      j === i ? { ...row, earningType: v } : row,
                    ),
                  );
                }}
              >
                {EARN.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {err && (
          <pre className="overflow-x-auto rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </pre>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete card
          </button>
        </div>
      </form>
    </div>
  );
}
