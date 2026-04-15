"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type MerchantRow = {
  id: string;
  displayName: string;
  mcc: string | null;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPick?: (m: MerchantRow) => void;
};

export function MerchantInput({ value, onChange, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<MerchantRow[]>([]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<MerchantRow[]>(
          `/merchants?q=${encodeURIComponent(q)}`,
          { auth: false },
        );
        setHits(data);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Where are you shopping?
      </label>
      <input
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-emerald-500/40 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        placeholder="e.g. Whole Foods, Starbucks…"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {open && (hits.length > 0 || loading) && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {loading && (
            <li className="px-3 py-2 text-zinc-500">Searching…</li>
          )}
          {hits.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(m.displayName);
                  onPick?.(m);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{m.displayName}</span>
                {m.mcc && (
                  <span className="text-xs text-zinc-500">MCC {m.mcc}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
