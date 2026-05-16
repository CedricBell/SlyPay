"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type CatalogTemplate = {
  id: string;
  name: string;
  issuer: string;
  colorHex?: string;
  imageUrl?: string;
  rules: Array<{
    category: string;
    multiplier: number;
    earningType: string;
  }>;
  /** From API — issuer-site intel from typed name, not a static catalog row. */
  intelAdHocFromName?: boolean;
};

type ParsePreview = {
  issuer: string | null;
  name: string | null;
  hasOfficialSite: boolean;
  officialHosts: string[];
};

type Props = {
  onApply: (t: CatalogTemplate) => void;
};

export function CardCatalogSuggest({ onApply }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<CatalogTemplate[]>([]);
  const [parsePreview, setParsePreview] = useState<ParsePreview | null>(null);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setParsePreview(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const p = await apiFetch<ParsePreview>(
          `/cards/catalog/parse?q=${encodeURIComponent(t)}`,
        );
        setParsePreview(p);
      } catch {
        setParsePreview(null);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const t = q.trim();
    const limit = t.length === 0 ? 100 : 24;
    const debounceMs = t.length === 0 ? 0 : 200;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<CatalogTemplate[]>(
          `/cards/catalog/suggestions?q=${encodeURIComponent(t)}&limit=${limit}`,
        );
        setHits(data);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(id);
  }, [q, open]);

  return (
    <div className="motion-enter relative z-10 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
      <label className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Bank & card name
      </label>
      <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
        One field — type e.g.{" "}
        <span className="font-mono">Chase Sapphire Preferred</span> or{" "}
        <span className="font-mono">Amex Gold</span>. We detect the issuer and
        product, then fetch rewards from the{" "}
        <strong>issuer&apos;s website</strong> (not a random PDF on Google).
      </p>
      <input
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-violet-500/30 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        placeholder="e.g. Chase Sapphire Preferred, Discover it, American Express Gold…"
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />

      {parsePreview?.issuer && parsePreview.name && q.trim().length >= 2 && (
        <div className="mt-2 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
          <p>
            <span className="font-semibold">Bank:</span> {parsePreview.issuer}
            <span className="mx-2 text-emerald-700/60 dark:text-emerald-300/60">
              ·
            </span>
            <span className="font-semibold">Card:</span> {parsePreview.name}
          </p>
          <p className="mt-1 text-emerald-800/90 dark:text-emerald-200/90">
            {parsePreview.hasOfficialSite ? (
              <>
                Intel will search{" "}
                <span className="font-mono">
                  {parsePreview.officialHosts.slice(0, 2).join(", ")}
                  {parsePreview.officialHosts.length > 2 ? "…" : ""}
                </span>{" "}
                (issuer site).
              </>
            ) : (
              <>
                Issuer domain not mapped yet — discovery may need API keys or
                admin URL until the bank is learned.
              </>
            )}
          </p>
        </div>
      )}

      {open && (hits.length > 0 || loading || q.trim().length === 0) && (
        <ul className="absolute left-4 right-4 z-[100] mt-1 max-h-60 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
          {loading && (
            <li className="px-3 py-2 text-sm text-zinc-500">Searching…</li>
          )}
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onApply(h);
                  setQ(`${h.issuer} — ${h.name}`);
                  setHits([]);
                  setOpen(false);
                }}
              >
                {h.imageUrl ? (
                  <Image
                    src={h.imageUrl}
                    alt={`${h.issuer} ${h.name}`}
                    width={64}
                    height={40}
                    className="h-10 w-16 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                    unoptimized
                  />
                ) : (
                  <span
                    className="h-10 w-16 rounded-md border border-zinc-200 dark:border-zinc-700"
                    style={{ backgroundColor: h.colorHex ?? "#0f172a" }}
                  />
                )}
                <span className="flex flex-col">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {h.intelAdHocFromName ? (
                      <>
                        <span className="mr-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                          Issuer site
                        </span>
                        {h.name}
                      </>
                    ) : (
                      h.name
                    )}
                  </span>
                  <span className="text-xs text-zinc-500">{h.issuer}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
