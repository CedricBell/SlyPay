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
};

type Props = {
  onApply: (t: CatalogTemplate) => void;
};

export function CardCatalogSuggest({ onApply }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<CatalogTemplate[]>([]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setHits([]);
      return;
    }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<CatalogTemplate[]>(
          `/cards/catalog/suggestions?q=${encodeURIComponent(t)}&limit=12`,
        );
        setHits(data);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div className="relative rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
      <label className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Quick fill from catalog
      </label>
      <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
        Type a bank or card name — suggestions are illustrative; adjust rules to
        match your product.
      </p>
      <input
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        placeholder="e.g. Chase Sapphire, Amex Gold, Citi Double…"
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {open && (hits.length > 0 || loading) && (
        <ul className="absolute left-4 right-4 z-30 mt-1 max-h-60 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
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
                  setQ("");
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
                    {h.name}
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
