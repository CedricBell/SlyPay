"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CardCatalogSuggest,
  type CatalogTemplate,
} from "@/components/CardCatalogSuggest";
import { CardThumbnail } from "@/components/CardThumbnail";
import { SelectedCatalogCard } from "@/components/SelectedCatalogCard";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";

export default function NewCardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [colorHex, setColorHex] = useState("#0f172a");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalogSlug, setCatalogSlug] = useState<string | null>(null);
  const [intelAdHocFromName, setIntelAdHocFromName] = useState(false);
  const [selected, setSelected] = useState<CatalogTemplate | null>(null);

  const hasPipelineSelection = catalogSlug !== null || intelAdHocFromName;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!hasPipelineSelection || !name.trim() || !issuer.trim()) {
      setErr(
        "Pick a match from the list below (curated or Web). Name and issuer come from that choice only.",
      );
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/cards", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          issuer: issuer.trim(),
          colorHex,
          catalogSlug: catalogSlug ?? undefined,
          intelAdHocFromName: intelAdHocFromName || undefined,
          rules: [],
        }),
      });
      router.push("/cards");
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Failed to create");
    } finally {
      setLoading(false);
    }
  };

  const applyCatalog = (t: CatalogTemplate) => {
    setSelected(t);
    if (t.intelAdHocFromName) {
      setIntelAdHocFromName(true);
      setCatalogSlug(null);
    } else {
      setIntelAdHocFromName(false);
      setCatalogSlug(t.id);
    }
    setName(t.name);
    setIssuer(t.issuer);
    if (t.colorHex) setColorHex(t.colorHex);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Add card</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Search your bank and card in one field. We pull rewards from the
          issuer&apos;s official site after you save.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <CardCatalogSuggest onApply={applyCatalog} />

        {!hasPipelineSelection && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            Select a suggestion (catalogue or{" "}
            <span className="font-semibold">Issuer site</span>) to continue.
            Reward rules are extracted automatically — not entered by hand.
          </p>
        )}

        {selected && hasPipelineSelection ? (
          <SelectedCatalogCard template={selected} accentColor={colorHex} />
        ) : (
          <div className="flex justify-center rounded-2xl border border-dashed border-zinc-300/80 bg-zinc-50/80 py-10 dark:border-zinc-700 dark:bg-zinc-950/40">
            <CardThumbnail
              name={name || "Your card"}
              issuer={issuer || "Issuer"}
              last4={null}
              colorHex={colorHex}
              size="lg"
            />
          </div>
        )}

        <div className="rounded-xl border border-zinc-200/80 bg-[var(--surface)] p-4 dark:border-zinc-800">
          <label className="mb-2 block text-sm font-medium">Accent color</label>
          <input
            type="color"
            className="h-10 w-full max-w-xs cursor-pointer rounded-lg border border-zinc-300 bg-white dark:border-zinc-700"
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
          />
        </div>

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !hasPipelineSelection}
          className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading ? "Saving…" : "Save card"}
        </button>
      </form>
    </div>
  );
}
