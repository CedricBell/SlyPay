"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusMessage } from "@/components/status-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";

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
  intelAdHocFromName?: boolean;
};

type ParsePreview = {
  issuer: string | null;
  name: string | null;
  trustedIssuer: boolean;
  hasOfficialSite: boolean;
  officialHosts: string[];
};

type ResolvedPreview = {
  issuer: string;
  name: string;
  trustedIssuer: boolean;
};

type Props = {
  onApply: (t: CatalogTemplate) => void;
  onQueryChange?: (query: string) => void;
  onResolvedChange?: (resolved: ResolvedPreview | null) => void;
  onOpenChange?: (open: boolean) => void;
};

export function CardCatalogSuggest({
  onApply,
  onQueryChange,
  onResolvedChange,
  onOpenChange,
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<CatalogTemplate[]>([]);
  const [parsePreview, setParsePreview] = useState<ParsePreview | null>(null);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setParsePreview(null);
      onResolvedChange?.(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const p = await apiFetch<ParsePreview>(
          `/cards/catalog/parse?q=${encodeURIComponent(t)}`,
        );
        setParsePreview(p);
        if (p.issuer && p.name) {
          onResolvedChange?.({
            issuer: p.issuer,
            name: p.name,
            trustedIssuer: p.trustedIssuer,
          });
        } else {
          onResolvedChange?.(null);
        }
      } catch {
        setParsePreview(null);
        onResolvedChange?.(null);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [q, onResolvedChange]);

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

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  return (
    <SurfaceCard
      className={`overflow-visible border-violet-500/25 bg-violet-500/5 p-4 ${open ? "relative z-40" : ""}`}
    >
      <Field
        label="Bank & card name"
        hint='Type your bank and card (e.g. "Chase Sapphire Preferred"). Pick a suggestion or keep typing — we match your bank automatically.'
      >
        <div className="relative">
          <Input
            className={inputClassName}
            placeholder="e.g. Chase Sapphire Preferred, Discover it, American Express Gold…"
            value={q}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              onQueryChange?.(v);
            }}
            autoComplete="off"
          />
          {open && (hits.length > 0 || loading || q.trim().length === 0) && (
            <ul className="absolute top-full left-0 right-0 z-[200] mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
              {loading && (
                <li className="space-y-2 px-3 py-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </li>
              )}
              {hits.map((h) => (
                <li key={h.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start gap-3 rounded-none px-3 py-2.5 text-left text-sm"
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
                        className="h-10 w-16 rounded-md border border-border object-cover"
                        unoptimized
                      />
                    ) : (
                      <span
                        className="h-10 w-16 rounded-md border border-border"
                        style={{ backgroundColor: h.colorHex ?? "#0f172a" }}
                      />
                    )}
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {h.intelAdHocFromName ? (
                          <>
                            <Badge className="mr-1.5 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100">
                              Issuer site
                            </Badge>
                            {h.name}
                          </>
                        ) : (
                          h.name
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{h.issuer}</span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      {parsePreview?.issuer && parsePreview.name && q.trim().length >= 2 && (
        <StatusMessage variant="success" className="mt-2">
          <p>
            <span className="font-semibold">Bank:</span> {parsePreview.issuer}
            <span className="mx-2 opacity-60">·</span>
            <span className="font-semibold">Card:</span> {parsePreview.name}
          </p>
          {parsePreview.trustedIssuer ? (
            <p className="mt-1 text-xs opacity-90">Recognized trusted issuer.</p>
          ) : null}
          {parsePreview.hasOfficialSite ? (
            <p className="mt-1">
              Rewards lookup may use{" "}
              <span className="font-mono">
                {parsePreview.officialHosts.slice(0, 2).join(", ")}
                {parsePreview.officialHosts.length > 2 ? "…" : ""}
              </span>
              .
            </p>
          ) : null}
        </StatusMessage>
      )}
    </SurfaceCard>
  );
}
