"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { CatalogCardArt } from "@/components/catalog-card-art";
import { StatusMessage } from "@/components/status-message";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Sparkles, Gift, Shield, Loader2 } from "lucide-react";

export type CatalogPreviewData = {
  slug: string;
  name: string;
  issuer: string;
  imageUrl: string | null;
  colorHex: string;
  hasExtract: boolean;
  rewardRules: Array<{
    category: string;
    multiplier: number;
    earningType: string;
    notes: string | null;
    excludedMerchants: string[];
  }>;
  summary: string | null;
  statementCredits: string[];
  protections: string[];
  perks: string[];
  intelJob: {
    status: string;
    errorMessage: string | null;
    finishedAt: string | null;
  } | null;
  inCatalog: boolean;
};

type Props = {
  catalogSlug: string | null;
  fallbackName: string;
  fallbackIssuer: string;
  fallbackImageUrl?: string | null;
  fallbackColorHex: string;
  intelQueuedAfterSave?: boolean;
};

export function CatalogLivePreview({
  catalogSlug,
  fallbackName,
  fallbackIssuer,
  fallbackImageUrl,
  fallbackColorHex,
  intelQueuedAfterSave = false,
}: Props) {
  const [preview, setPreview] = useState<CatalogPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!catalogSlug) {
      setPreview(null);
      setErr(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErr(null);

    const load = async () => {
      try {
        const data = await apiFetch<CatalogPreviewData>(
          `/cards/catalog/${encodeURIComponent(catalogSlug)}/preview`,
        );
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) {
          setPreview(null);
          setErr("Could not load catalog preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(load, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [catalogSlug]);

  const name = preview?.name ?? fallbackName;
  const issuer = preview?.issuer ?? fallbackIssuer;
  const imageUrl = preview?.imageUrl ?? fallbackImageUrl;
  const colorHex = preview?.colorHex ?? fallbackColorHex;

  const jobFailed =
    preview?.intelJob?.status === "FAILED" ||
    preview?.intelJob?.status === "SKIPPED_NO_SOURCE";
  const jobRunning =
    preview?.intelJob?.status === "PENDING" ||
    preview?.intelJob?.status === "RUNNING";

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-border/60 bg-gradient-to-b from-violet-500/[0.06] to-transparent px-5 py-6">
        <CatalogCardArt
          name={name}
          issuer={issuer}
          imageUrl={imageUrl}
          colorHex={colorHex}
          variant="hero"
        />
        <div className="mt-4 space-y-1 text-center">
          <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
          <p className="text-sm text-muted-foreground">{issuer}</p>
          {catalogSlug ? (
            <code className="mt-1 inline-block rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {catalogSlug}
            </code>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {loading && !preview?.rewardRules.length ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading catalog data…
          </div>
        ) : null}

        {preview?.summary ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {preview.summary}
          </p>
        ) : null}

        {preview?.rewardRules && preview.rewardRules.length > 0 ? (
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
              <Sparkles className="size-3.5" />
              Earn rates
            </p>
            <ul className="mt-2 space-y-1.5">
              {preview.rewardRules.map((r) => (
                <li key={`${r.category}-${r.multiplier}`} className="text-sm">
                  <span className="font-medium">
                    {r.multiplier}× {r.category.replace(/_/g, " ")}
                  </span>
                  <span className="text-muted-foreground"> ({r.earningType})</span>
                  {r.excludedMerchants?.length ? (
                    <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                      Excludes: {r.excludedMerchants.join(", ")}
                    </span>
                  ) : null}
                  {r.notes ? (
                    <span className="block text-xs text-muted-foreground">{r.notes}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : intelQueuedAfterSave ? (
          <StatusMessage variant="info">
            <p className="text-sm font-medium">Rewards lookup after save</p>
            <p className="mt-1 text-xs">
              We will fetch official issuer terms when you save this card.
            </p>
          </StatusMessage>
        ) : preview?.hasExtract ? (
          <p className="text-sm text-muted-foreground">Extract on file — no mapped rules yet.</p>
        ) : null}

        {preview?.statementCredits && preview.statementCredits.length > 0 ? (
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
              <Gift className="size-3.5" />
              Credits
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {preview.statementCredits.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {preview?.protections && preview.protections.length > 0 ? (
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
              <Shield className="size-3.5" />
              Protections
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {preview.protections.slice(0, 4).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {jobFailed && preview?.intelJob?.errorMessage ? (
          <StatusMessage variant="error">
            <p className="text-sm font-medium">Last intel run failed</p>
            <p className="mt-1 text-xs">{preview.intelJob.errorMessage}</p>
          </StatusMessage>
        ) : null}

        {jobRunning ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <span>Analyzing issuer terms…</span>
          </div>
        ) : null}

        {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}

        {!preview?.rewardRules.length &&
        !intelQueuedAfterSave &&
        !jobRunning &&
        !loading &&
        catalogSlug ? (
          <Badge className="text-xs">
            No rewards in catalog yet — save to run intel
          </Badge>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
