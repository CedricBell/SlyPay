"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  CardCatalogSuggest,
  type CatalogTemplate,
} from "@/components/CardCatalogSuggest";
import { CardThumbnail } from "@/components/CardThumbnail";
import { SelectedCatalogCard } from "@/components/SelectedCatalogCard";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function CardPreviewPanel({
  selected,
  pickedFromList,
  displayName,
  displayIssuer,
  colorHex,
  className,
}: {
  selected: CatalogTemplate | null;
  pickedFromList: boolean;
  displayName: string;
  displayIssuer: string;
  colorHex: string;
  className?: string;
}) {
  if (selected && pickedFromList) {
    return (
      <div className={className}>
        <SelectedCatalogCard template={selected} accentColor={colorHex} />
      </div>
    );
  }

  return (
    <SurfaceCard
      className={cn(
        "flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:text-left lg:flex-col lg:items-center lg:text-center",
        className,
      )}
    >
      <CardThumbnail
        name={displayName || "Your card"}
        issuer={displayIssuer}
        last4={null}
        colorHex={colorHex}
        size="lg"
        className="shrink-0"
      />
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-semibold tracking-tight">
          {displayName || "Your card"}
        </p>
        <p className="truncate text-xs text-muted-foreground">{displayIssuer}</p>
        <p className="text-[11px] text-muted-foreground/80">
          Preview updates as you type or pick a suggestion.
        </p>
      </div>
    </SurfaceCard>
  );
}

export default function NewCardPage() {
  const router = useRouter();
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
          colorHex,
          catalogSlug: catalogSlug ?? undefined,
          intelAdHocFromName:
            intelAdHocFromName ||
            (!catalogSlug && (resolved?.trustedIssuer ?? false))
              ? true
              : undefined,
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
        variant="outline"
        size="lg"
        asChild
        className="flex-1 sm:flex-none"
      >
        <Link href="/cards">Cancel</Link>
      </Button>
    </>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/cards">← Back to wallet</Link>
        </Button>
      </div>

      <PageHeader
        title="Add card"
        description="Type any bank and card name. We match your bank against trusted issuers and pull rewards when possible."
      />

      <form onSubmit={submit} className="space-y-5 pb-24 md:pb-0">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-5">
            <CardCatalogSuggest
              onApply={applyCatalog}
              onQueryChange={handleQueryChange}
              onResolvedChange={handleResolvedChange}
              onOpenChange={setSuggestionsOpen}
            />

            <SurfaceCard className="p-4">
              <Field label="Accent color">
                <Input
                  type="color"
                  className="h-10 max-w-xs cursor-pointer p-1"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                />
              </Field>
            </SurfaceCard>

            {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}

            <div className="hidden flex-wrap gap-3 md:flex">{actionButtons}</div>
          </div>

          <CardPreviewPanel
            selected={selected}
            pickedFromList={pickedFromList}
            displayName={displayName}
            displayIssuer={displayIssuer}
            colorHex={colorHex}
            className={cn(
              "lg:sticky lg:top-24",
              suggestionsOpen && "hidden lg:block",
            )}
          />
        </div>

        <div
          className={cn(
            "fixed inset-x-0 z-40 border-t border-border/80 bg-background/90 px-4 py-3 backdrop-blur-xl",
            "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:hidden",
          )}
        >
          <div className="mx-auto flex max-w-3xl gap-2">{actionButtons}</div>
        </div>
      </form>
    </div>
  );
}
