"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardThumbnail } from "@/components/CardThumbnail";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SurfaceCard } from "@/components/ui/surface-card";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";

type WalletPreview = {
  ruleHighlights: string[];
  pdfSummary: string | null;
  benefitsSummary: string | null;
  statementCreditHints: string[];
  protectionHints: string[];
  scoreBreakdown?: {
    grossRewardsUsd: number;
    statementCreditsUsd: number;
    annualFeeUsd: number;
    netValueUsd: number;
    scoreOutOf100: number;
    spendProfileLabel: string;
  };
};

type CardDetail = {
  id: string;
  name: string;
  issuer: string;
  last4: string | null;
  colorHex: string | null;
  isActive: boolean;
  catalogImageUrl?: string | null;
  rewardRules: Array<{
    category: string;
    multiplier: number;
    earningType: string;
    notes?: string | null;
    excludedMerchants?: string[];
  }>;
  catalogLinked?: boolean;
  catalogSlug?: string | null;
  hasOfficialPdfExtract?: boolean;
  officialDocumentUrl?: string | null;
  walletPreview?: WalletPreview;
  walletScore?: number;
  walletScoreAnalyzing?: boolean;
};

export default function EditCardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [last4, setLast4] = useState("");
  const [colorHex, setColorHex] = useState("#0f172a");
  const [isActive, setIsActive] = useState(true);
  const [rules, setRules] = useState<CardDetail["rewardRules"]>([]);
  const [catalogImageUrl, setCatalogImageUrl] = useState<string | null>(null);
  const [intel, setIntel] = useState<{
    catalogSlug: string | null;
    officialDocumentUrl: string | null;
    hasOfficialPdfExtract: boolean;
    walletPreview: WalletPreview | undefined;
    walletScore: number | undefined;
    walletScoreAnalyzing?: boolean;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [init, setInit] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiFetch<CardDetail>(`/cards/${id}`);
        setName(c.name);
        setIssuer(c.issuer);
        setLast4(c.last4 ?? "");
        setColorHex(c.colorHex ?? "#0f172a");
        setIsActive(c.isActive);
        setRules(c.rewardRules);
        setCatalogImageUrl(c.catalogImageUrl ?? null);
        setIntel({
          catalogSlug: c.catalogSlug ?? null,
          officialDocumentUrl: c.officialDocumentUrl ?? null,
          hasOfficialPdfExtract: Boolean(c.hasOfficialPdfExtract),
          walletPreview: c.walletPreview,
          walletScore: c.walletScore,
          walletScoreAnalyzing: c.walletScoreAnalyzing,
        });
        setInit(true);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setErr("Could not load card");
      }
    })();
  }, [id, router]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await apiFetch(`/cards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          last4: last4 || undefined,
          colorHex,
          isActive,
        }),
      });
      router.push("/cards");
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm("Remove this card from your wallet?")) return;
    setLoading(true);
    try {
      await apiFetch(`/cards/${id}`, { method: "DELETE" });
      router.push("/cards");
    } catch {
      setErr("Delete failed");
    } finally {
      setLoading(false);
    }
  };

  if (!init && !err) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (err && !init) {
    return <StatusMessage variant="error">{err}</StatusMessage>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Wallet card"
        description="Personalize your copy. Product name, issuer and reward rules come from the shared catalog — contact an admin to change those."
      />
      <div className="flex justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-6">
        <CardThumbnail
          name={name || "Card"}
          issuer={issuer || "Issuer"}
          last4={last4 || null}
          colorHex={colorHex}
          imageUrl={catalogImageUrl}
          size="lg"
        />
      </div>

      <SurfaceCard className="p-4 text-sm">
        <p className="font-medium">{name}</p>
        <p className="text-muted-foreground">{issuer}</p>
        {intel?.catalogSlug ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Catalog product:{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              {intel.catalogSlug}
            </code>
          </p>
        ) : null}
      </SurfaceCard>

      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Last 4 digits">
            <Input
              className={inputClassName}
              value={last4}
              maxLength={4}
              onChange={(e) => setLast4(e.target.value)}
            />
          </Field>
          <Field label="Accent color">
            <Input
              type="color"
              className="h-10 cursor-pointer p-1"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="is-active"
            checked={isActive}
            onCheckedChange={(v) => setIsActive(v === true)}
          />
          <Label htmlFor="is-active" className="text-sm font-normal">
            Active (inactive cards are ignored by the engine)
          </Label>
        </div>

        {intel &&
          (intel.catalogSlug ||
            intel.officialDocumentUrl ||
            intel.hasOfficialPdfExtract) && (
            <SurfaceCard className="border-violet-500/30 bg-violet-500/5 p-4 text-sm">
              <p className="font-semibold text-primary">Catalog intelligence</p>
              {intel.walletScoreAnalyzing ? (
                <p className="mt-2 text-muted-foreground">Analyzing rewards…</p>
              ) : intel.walletScore != null ? (
                <p className="mt-2 text-muted-foreground">
                  Score {Math.round(intel.walletScore)}/100
                </p>
              ) : null}
              {intel.officialDocumentUrl ? (
                <Button variant="link" className="mt-2 h-auto p-0" asChild>
                  <a href={intel.officialDocumentUrl} target="_blank" rel="noreferrer">
                    Official PDF
                  </a>
                </Button>
              ) : null}
            </SurfaceCard>
          )}

        {rules.length > 0 ? (
          <SurfaceCard className="p-4">
            <p className="text-sm font-medium">Reward rules (read-only)</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {rules.map((r) => (
                <li key={`${r.category}-${r.multiplier}`}>
                  <span className="font-medium text-foreground">
                    {r.multiplier}× {r.category}
                  </span>{" "}
                  ({r.earningType})
                  {r.excludedMerchants && r.excludedMerchants.length > 0 ? (
                    <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                      Excludes: {r.excludedMerchants.join(", ")}
                    </span>
                  ) : null}
                  {r.notes ? (
                    <span className="mt-0.5 block text-xs">{r.notes}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </SurfaceCard>
        ) : null}

        {intel?.walletPreview &&
        (intel.walletPreview.benefitsSummary ||
          intel.walletPreview.statementCreditHints.length > 0 ||
          intel.walletPreview.protectionHints.length > 0) ? (
          <SurfaceCard className="border-emerald-500/25 bg-emerald-500/5 p-4 text-sm">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">
              Card benefits
            </p>
            {intel.walletPreview.benefitsSummary ? (
              <p className="mt-2 text-muted-foreground">
                {intel.walletPreview.benefitsSummary}
              </p>
            ) : null}
            {intel.walletPreview.statementCreditHints.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Statement credits
                </p>
                <ul className="mt-1.5 space-y-1">
                  {intel.walletPreview.statementCreditHints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}
            {intel.walletPreview.protectionHints.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Protections
                </p>
                <ul className="mt-1.5 space-y-1">
                  {intel.walletPreview.protectionHints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}
          </SurfaceCard>
        ) : null}

        {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={remove}
            disabled={loading}
          >
            Remove from wallet
          </Button>
        </div>
      </form>
    </div>
  );
}
