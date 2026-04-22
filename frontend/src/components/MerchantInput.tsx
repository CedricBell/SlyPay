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
      <label className="mb-2 block text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Where are you shopping?
      </label>
      <input
        className="w-full rounded-2xl border border-zinc-200/80 bg-white/90 px-4 py-3 text-zinc-900 shadow-inner outline-none ring-emerald-500/35 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        placeholder="e.g. Whole Foods, Starbucks…"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {open && (hits.length > 0 || loading) && (
        <ul className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-zinc-200/80 bg-[var(--surface-elevated)] text-sm shadow-xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95">
          {loading && (
            <li className="px-3 py-2 text-zinc-500">Searching…</li>
          )}
          {hits.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-4 py-2.5 text-left transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10"
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
