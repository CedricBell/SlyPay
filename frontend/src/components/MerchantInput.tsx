"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type MerchantRow = {
  id: string;
  displayName: string;
  mcc: string | null;
  notes?: string | null;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPick?: (m: MerchantRow) => void;
  onUserInput?: () => void;
  /** Bias Google Places text search when the user has shared location. */
  locationLat?: number | null;
  locationLng?: number | null;
};

export function MerchantInput({
  value,
  onChange,
  onPick,
  onUserInput,
  locationLat,
  locationLng,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<MerchantRow[]>([]);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const updateMenuRect = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuRect({
      top: r.bottom + 8,
      left: r.left,
      width: r.width,
    });
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q });
        if (
          typeof locationLat === "number" &&
          typeof locationLng === "number" &&
          Number.isFinite(locationLat) &&
          Number.isFinite(locationLng)
        ) {
          params.set("lat", String(locationLat));
          params.set("lng", String(locationLng));
        }
        const data = await apiFetch<MerchantRow[]>(
          `/merchants?${params.toString()}`,
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
  }, [value, locationLat, locationLng]);

  useEffect(() => {
    if (!open) return;
    updateMenuRect();
    window.addEventListener("resize", updateMenuRect);
    window.addEventListener("scroll", updateMenuRect, true);
    return () => {
      window.removeEventListener("resize", updateMenuRect);
      window.removeEventListener("scroll", updateMenuRect, true);
    };
  }, [open, updateMenuRect, hits.length, loading]);

  const showMenu = open && (hits.length > 0 || loading);

  const menu =
    showMenu && menuRect && typeof document !== "undefined"
      ? createPortal(
          <ul
            role="listbox"
            className="max-h-56 overflow-auto rounded-2xl border border-border bg-popover text-sm shadow-2xl"
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              zIndex: 9999,
            }}
          >
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
                  ) : m.notes ? (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {m.notes}
                    </span>
                  ) : null}
                </Button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <Field label="Where are you shopping?">
      <div ref={anchorRef} className="relative">
        <Input
          className={inputClassName}
          placeholder="e.g. Whole Foods, Starbucks…"
          value={value}
          onFocus={() => {
            setOpen(true);
            updateMenuRect();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            onUserInput?.();
            onChange(e.target.value);
            setOpen(true);
          }}
          autoComplete="off"
          aria-expanded={showMenu}
          aria-haspopup="listbox"
        />
        {menu}
      </div>
    </Field>
  );
}
