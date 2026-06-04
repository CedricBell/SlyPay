"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  CardCatalogSuggest,
  type CatalogTemplate,
} from "@/components/CardCatalogSuggest";
import { CatalogCardArt } from "@/components/catalog-card-art";
import { CatalogLivePreview } from "@/components/catalog-live-preview";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { apiFetch, ApiError, formatCaughtApiError, invalidateApiCache } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { cn } from "@/lib/utils";

export default function NewCardPage() {
  const router = useRouter();
  const { refreshCards } = useAppData();
  const [query, setQuery] = useState("");
  const [resolved, setResolved] = useState<{
    issuer: string;
    name: string;
    trustedIssuer: boolean;
  } | null>(null);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [colorHex, setColorHex] = useState("#0f172a");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalogSlug, setCatalogSlug] = useState<string | null>(null);
  const [intelAdHocFromName, setIntelAdHocFromName] = useState(false);
  const [selected, setSelected] = useState<CatalogTemplate | null>(null);
  const [pickedFromList, setPickedFromList] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const displayName = pickedFromList ? name : (resolved?.name ?? name) || query;
  const displayIssuer =
    pickedFromList ? issuer : (resolved?.issuer ?? issuer) || "Issuer";

  const previewImageUrl = selected?.imageUrl ?? null;
  const hasOfficialArt = Boolean(previewImageUrl?.trim());

  const canSubmit =
    query.trim().length >= 2 &&
    (pickedFromList || resolved !== null || catalogSlug !== null);


  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    setPickedFromList(false);
    setCatalogSlug(null);
    setIntelAdHocFromName(false);
    setSelected(null);
  }, []);

  const handleResolvedChange = useCallback(
    (r: { issuer: string; name: string; trustedIssuer: boolean } | null) => {
      setResolved(r);
      if (r && !pickedFromList) {
        setName(r.name);
        setIssuer(r.issuer);
      }
    },
    [pickedFromList],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!canSubmit) {
      setErr("Enter at least a bank and card name (2+ characters).");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/cards", {
        method: "POST",
        body: JSON.stringify({
          rawQuery: query.trim(),
          name: (pickedFromList ? name : resolved?.name ?? name).trim(),
          issuer: (pickedFromList ? issuer : resolved?.issuer ?? issuer).trim(),
          colorHex: hasOfficialArt ? undefined : colorHex,
          catalogSlug: catalogSlug ?? undefined,
          intelAdHocFromName:
            intelAdHocFromName ||
            (!catalogSlug && (resolved?.trustedIssuer ?? false))
              ? true
              : undefined,
          rules: [],
        }),
      });
      invalidateApiCache("/cards");
      await refreshCards(true);
      router.push("/cards");
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Failed to create");
    } finally {
      setLoading(false);
    }
  };

  const applyCatalog = (t: CatalogTemplate) => {
    setPickedFromList(true);
    setSelected(t);
    setQuery(`${t.issuer} — ${t.name}`);
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

  const actionButtons = (
    <>
      <Button
        type="submit"
        variant="gradient"
        size="xl"
        disabled={loading || !canSubmit}
        className="min-w-[9rem] flex-1 sm:flex-none"
      >
        {loading ? "Saving…" : "Save card"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        asChild
        className="flex-1 text-muted-foreground sm:flex-none"
      >
        <Link href="/cards">Cancel</Link>
      </Button>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/cards">← Back to wallet</Link>
        </Button>
      </div>

      <PageHeader
        title="Add card"
        description="Search the catalog, see rewards and card art live, then save to your wallet."
      />

      <form onSubmit={submit} className="space-y-6 pb-24 md:pb-8">
        <div
          className={cn(
            "grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start",
            suggestionsOpen && "lg:grid-cols-1",
          )}
        >
          <div className="min-w-0 space-y-5">
            <CardCatalogSuggest
              onApply={applyCatalog}
              onQueryChange={handleQueryChange}
              onResolvedChange={handleResolvedChange}
              onOpenChange={setSuggestionsOpen}
            />

            {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}

            {!suggestionsOpen ? (
              <div className="hidden flex-wrap gap-3 md:flex">{actionButtons}</div>
            ) : null}
          </div>

          {!suggestionsOpen && (
            <div className="min-w-0 lg:sticky lg:top-24">
              {catalogSlug ? (
                <CatalogLivePreview
                  catalogSlug={catalogSlug}
                  fallbackName={displayName}
                  fallbackIssuer={displayIssuer}
                  fallbackImageUrl={previewImageUrl}
                  fallbackColorHex={colorHex}
                  intelQueuedAfterSave={
                    intelAdHocFromName ||
                    (!catalogSlug && (resolved?.trustedIssuer ?? false))
                  }
                />
              ) : (
                <SurfaceCard className="overflow-hidden p-0">
                  <div className="border-b border-border/60 bg-gradient-to-b from-violet-500/[0.06] to-transparent px-5 py-6">
                    <CatalogCardArt
                      name={displayName || "Your card"}
                      issuer={displayIssuer}
                      imageUrl={previewImageUrl}
                      colorHex={colorHex}
                      variant="hero"
                    />
                    <div className="mt-4 space-y-1 text-center">
                      <h2 className="text-lg font-semibold tracking-tight">
                        {displayName || "Your card"}
                      </h2>
                      <p className="text-sm text-muted-foreground">{displayIssuer}</p>
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <StatusMessage variant="info">
                      <p className="text-sm">
                        Pick a catalog card or keep typing to match your bank. Rewards
                        and official card art appear here when available.
                      </p>
                    </StatusMessage>
                  </div>
                </SurfaceCard>
              )}
            </div>
          )}
        </div>

        {!suggestionsOpen ? (
          <div
            className={cn(
              "fixed inset-x-0 z-30 border-t border-border bg-background px-4 py-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)]",
              "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:hidden",
            )}
          >
            <div className="mx-auto flex w-full max-w-6xl gap-2">{actionButtons}</div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
