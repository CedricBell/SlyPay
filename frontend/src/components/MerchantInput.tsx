"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type MerchantRow = {
  id: string;
  displayName: string;
  mcc: string | null;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPick?: (m: MerchantRow) => void;
  onUserInput?: () => void;
};

export function MerchantInput({
  value,
  onChange,
  onPick,
  onUserInput,
}: Props) {
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
    <Field label="Where are you shopping?">
      <div className="relative">
        <Input
          className={inputClassName}
          placeholder="e.g. Whole Foods, Starbucks…"
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            onUserInput?.();
            onChange(e.target.value);
          }}
          autoComplete="off"
        />
        {open && (hits.length > 0 || loading) && (
          <ul className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-border bg-[var(--sly-surface-elevated)] text-sm shadow-xl backdrop-blur-xl">
            {loading && (
              <li className="space-y-2 px-3 py-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </li>
            )}
            {hits.map((m) => (
              <li key={m.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full flex-col items-start rounded-none px-4 py-2.5 text-left first:rounded-t-2xl last:rounded-b-2xl hover:bg-primary/10"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(m.displayName);
                    onPick?.(m);
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">{m.displayName}</span>
                  {m.mcc ? (
                    <span className="text-xs text-muted-foreground">
                      MCC {m.mcc}
                    </span>
                  ) : null}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
