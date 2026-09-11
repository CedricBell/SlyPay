"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardThumbnail } from "@/components/CardThumbnail";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { inputClassName } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { SurfaceCard } from "@/components/ui/surface-card";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";
import { intelHasFailed } from "@/lib/card-intel-status";
import { walletPerkKey, type MappedIntelJob, type WalletPerkPreview } from "@/lib/map-credit-card";
import type { StatementCreditDisplay } from "@/lib/statement-credit-display";

type WalletPreview = {
  ruleHighlights: string[];
  pdfSummary: string | null;
  benefitsSummary: string | null;
  statementCreditHints: string[];
  statementCredits?: StatementCreditDisplay[];
  protectionHints: string[];
  perkHints?: WalletPerkPreview[];
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
  walletScoreAnalyzing?: boolean;
  intelJob?: MappedIntelJob | null;
};

export default function EditCardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [missingNote, setMissingNote] = useState("");
  const [missingNoteSent, setMissingNoteSent] = useState(false);
  const [rules, setRules] = useState<CardDetail["rewardRules"]>([]);
  const [catalogImageUrl, setCatalogImageUrl] = useState<string | null>(null);
  const [intel, setIntel] = useState<{
    catalogSlug: string | null;
    officialDocumentUrl: string | null;
    hasOfficialPdfExtract: boolean;
    walletPreview: WalletPreview | undefined;
    walletScoreAnalyzing?: boolean;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [intelJob, setIntelJob] = useState<MappedIntelJob | null>(null);
  const [refreshingIntel, setRefreshingIntel] = useState(false);
  const [init, setInit] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiFetch<CardDetail>(`/cards/${id}`);
        setName(c.name);
        setIssuer(c.issuer);
        setIsActive(c.isActive);
        setRules(c.rewardRules);
        setCatalogImageUrl(c.catalogImageUrl ?? null);
        setIntelJob(c.intelJob ?? null);
        setIntel({
          catalogSlug: c.catalogSlug ?? null,
          officialDocumentUrl: c.officialDocumentUrl ?? null,
          hasOfficialPdfExtract: Boolean(c.hasOfficialPdfExtract),
          walletPreview: c.walletPreview,
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
        body: JSON.stringify({ isActive }),
      });
      router.push("/cards");
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const refreshIntel = async () => {
    setErr(null);
    setRefreshingIntel(true);
    try {
      await apiFetch(`/cards/${id}/refresh-intel`, { method: "POST" });
      setIntelJob({
        status: "PENDING",
        errorMessage: null,
        startedAt: null,
        createdAt: new Date().toISOString(),
      });
      setIntel((prev) =>
        prev ? { ...prev, walletScoreAnalyzing: true } : prev,
      );
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Could not restart rewards lookup");
    } finally {
      setRefreshingIntel(false);
    }
  };

  const submitMissingNote = async () => {
    const body = missingNote.trim();
    if (body.length < 8) {
      setErr("Please describe what’s missing (at least 8 characters).");
      return;
    }
    setErr(null);
    try {
      await apiFetch(`/cards/${id}/contributions`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setMissingNote("");
      setMissingNoteSent(true);
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Could not send note");
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

      {intelHasFailed(intelJob) ? (
        <StatusMessage variant="error">
          {intelJob?.errorMessage?.slice(0, 280) ?? "Rewards lookup failed."}
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshingIntel}
              onClick={() => void refreshIntel()}
            >
              {refreshingIntel ? "Retrying…" : "Retry rewards lookup"}
            </Button>
          </div>
        </StatusMessage>
      ) : null}
      {intel?.walletScoreAnalyzing ? (
        <p className="text-sm text-muted-foreground">Analyzing rewards from official documentation…</p>
      ) : null}

      <form onSubmit={save} className="space-y-4">
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

        {intel?.officialDocumentUrl ? (
          <p className="text-sm">
            <a
              href={intel.officialDocumentUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline"
            >
              Official card documentation
            </a>
          </p>
        ) : null}

        {intel?.walletPreview &&
        (intel.walletPreview.statementCreditHints.length > 0 ||
          intel.walletPreview.protectionHints.length > 0 ||
          (intel.walletPreview.perkHints?.length ?? 0) > 0) ? (
          <SurfaceCard className="border-emerald-500/25 bg-emerald-500/5 p-4 text-sm">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">
              From official documentation
            </p>
            {(intel.walletPreview.statementCredits?.length ??
              intel.walletPreview.statementCreditHints.length) > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Statement credits
                </p>
                <ul className="mt-2 space-y-3">
                  {(intel.walletPreview.statementCredits?.length
                    ? intel.walletPreview.statementCredits
                    : intel.walletPreview.statementCreditHints.map((hint) => ({
                        title: hint,
                        amountText: null,
                        cadence: null,
                        amountSummary: null,
                        merchantHint: null,
                        enrollmentRequired: false,
                        detail: null,
                      }))
                  ).map((c) => (
                    <li key={`${c.title}-${c.amountText}-${c.cadence}`}>
                      <p className="font-medium text-foreground">{c.title}</p>
                      {c.amountSummary ? (
                        <p className="mt-0.5 font-medium text-foreground/90">
                          {c.amountSummary}
                        </p>
                      ) : null}
                      {c.merchantHint &&
                      !c.title.toLowerCase().includes(c.merchantHint.toLowerCase()) ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.merchantHint}
                        </p>
                      ) : null}
                      {c.detail ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                      ) : null}
                      {c.enrollmentRequired ? (
                        <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
                          Enrollment required
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {intel.walletPreview.protectionHints.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Protections & insurance
                </p>
                <ul className="mt-1.5 space-y-1">
                  {intel.walletPreview.protectionHints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}
            {(intel.walletPreview.perkHints?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Travel, hotel & programs
                </p>
                <ul className="mt-2 space-y-3">
                  {intel.walletPreview.perkHints!.map((perk, index) => (
                    <li key={walletPerkKey(perk, index)}>
                      <p className="font-medium text-foreground">{perk.title}</p>
                      {perk.description && perk.description !== perk.title ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {perk.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SurfaceCard>
        ) : null}

        <SurfaceCard className="p-4 text-sm">
          <p className="font-medium">Missing something?</p>
          <p className="mt-1 text-muted-foreground">
            Tell us what benefit or rule is wrong or missing. An admin will review
            before it affects recommendations.
          </p>
          {missingNoteSent ? (
            <StatusMessage variant="success" className="mt-3">
              Thanks — your note was sent for review.
            </StatusMessage>
          ) : (
            <>
              <textarea
                className={`${inputClassName} mt-3 min-h-[88px] w-full resize-y`}
                placeholder="e.g. Missing return protection, wrong Uber credit amount…"
                value={missingNote}
                onChange={(e) => setMissingNote(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void submitMissingNote()}
              >
                Send for review
              </Button>
            </>
          )}
        </SurfaceCard>

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
