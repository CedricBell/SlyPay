"use client";

import { Fragment, useState } from "react";
import { Copy, Check, Sparkles, CreditCard, Gift, Shield, BadgeCheck } from "lucide-react";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";
import { CardThumbnail } from "@/components/CardThumbnail";
import { StatusMessage } from "@/components/status-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  formatStatementCreditLine,
  formatProtectionLine,
  type CardSpendBenefits,
} from "@/lib/recommendation-benefits";
import { categoryLabelFromUi } from "@/lib/spend-category-ui";
import type { SpendCategory } from "@prisma/client";

type RotatingQuarter = {
  validFrom: string;
  validUntil: string;
  categories: string[];
  multiplier: number;
  label: string;
  details?: string;
};

type Ranked = {
  cardId: string;
  cardName: string;
  issuer: string;
  effectiveMultiplier: number;
  earningType: string;
  rateLabel: string;
  last4?: string | null;
  colorHex?: string | null;
  benefits: CardSpendBenefits;
  explanationLines: string[];
  catalogRotatingQuarters?: RotatingQuarter[] | null;
};

function formatIsoRange(from: string, until: string): string {
  try {
    const a = new Date(from);
    const b = new Date(until);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
    const opts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}`;
  } catch {
    return "";
  }
}

function BenefitsPanel({
  benefits,
  compact,
}: {
  benefits: CardSpendBenefits;
  compact?: boolean;
}) {
  const hasCredits = benefits.statementCredits.length > 0;
  const hasProtections = benefits.protections.length > 0;
  const hasLoyalty = benefits.loyaltyPerks.length > 0;
  const hasCaveats = benefits.relevantCaveats.length > 0;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {benefits.merchantExclusionNotes.length > 0 && (
        <StatusMessage variant="warning" className="text-xs">
          {benefits.merchantExclusionNotes.join(" ")}
        </StatusMessage>
      )}

      {benefits.benefitsSummary && !compact && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {benefits.benefitsSummary}
        </p>
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Earn rate
        </p>
        <ul className="mt-1 space-y-1">
          {benefits.categoryEarnLines.map((line, i) => (
            <li key={`earn-${i}`} className="flex gap-2 text-sm">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {hasCredits && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Credits & reimbursements
          </p>
          <ul className="mt-1 space-y-1.5">
            {benefits.statementCredits.map((c, i) => (
              <li key={`sc-${i}`} className="flex gap-2 text-sm">
                <Gift className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <span>{formatStatementCreditLine(c)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasProtections && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
            Protections & insurance
          </p>
          <ul className="mt-1 space-y-1.5">
            {benefits.protections.map((p, i) => (
              <li key={`pr-${i}`} className="flex gap-2 text-sm">
                <Shield className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
                <span>{formatProtectionLine(p)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(benefits.perks.length > 0 || benefits.welcomeOffer) && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
            Card perks
          </p>
          <ul className="mt-1 space-y-1">
            {benefits.welcomeOffer && (
              <li className="flex gap-2 text-sm">
                <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-indigo-600" />
                <span>{benefits.welcomeOffer}</span>
              </li>
            )}
            {benefits.perks.map((p, i) => (
              <li key={`pk-${i}`} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{p.title}</span>
                {" — "}
                {p.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasLoyalty && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
            Loyalty & status perks
          </p>
          <ul className="mt-1 space-y-1">
            {benefits.loyaltyPerks.map((p, i) => (
              <li key={`lp-${i}`} className="text-sm text-muted-foreground">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasCaveats && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Fine print
          </p>
          <ul className="mt-1 space-y-1">
            {benefits.relevantCaveats.map((c, i) => (
              <li key={`cv-${i}`} className="text-xs text-muted-foreground">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && benefits.summarySnippet && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {benefits.summarySnippet}
          {benefits.summarySnippet.length >= 320 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

export type MismatchKind =
  | "WRONG_MERCHANT"
  | "WRONG_CATEGORY"
  | "REWARD_MISMATCH"
  | "WRONG_CARD_IN_PRACTICE"
  | "OTHER";

type Props = {
  resolvedCategory: string;
  evaluationDate?: string | null;
  bestCard: {
    name: string;
    issuer: string;
    last4: string | null;
    colorHex?: string | null;
  } | null;
  bestCardBenefits?: CardSpendBenefits | null;
  reasoning: string[];
  ranked: Ranked[];
  alternatesTied: string[];
  trace: string[];
  marketBest: {
    cardId: string;
    cardName: string;
    issuer: string;
    effectiveMultiplier: number;
    earningType: string;
    rateLabel: string;
    benefits: CardSpendBenefits | null;
    catalogName?: string;
  } | null;
  recommendationId?: string | null;
  merchantLabel?: string | null;
};

const MISMATCH_OPTIONS: { kind: MismatchKind; label: string }[] = [
  { kind: "WRONG_MERCHANT", label: "Wrong store" },
  { kind: "WRONG_CATEGORY", label: "Wrong category" },
  { kind: "REWARD_MISMATCH", label: "Reward didn't match" },
  { kind: "WRONG_CARD_IN_PRACTICE", label: "Better card in practice" },
  { kind: "OTHER", label: "Other" },
];

export function RecommendationCard({
  resolvedCategory,
  evaluationDate,
  bestCard,
  bestCardBenefits,
  reasoning,
  ranked,
  alternatesTied,
  trace,
  marketBest,
  recommendationId,
  merchantLabel,
}: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const categoryLabel = categoryLabelFromUi(resolvedCategory as SpendCategory);

  const copyLast4 = async () => {
    if (!bestCard?.last4) return;
    try {
      await navigator.clipboard.writeText(bestCard.last4);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const submit = async (kind: MismatchKind) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch<{ ok: boolean }>("/recommendations/feedback", {
        method: "POST",
        body: JSON.stringify({
          recommendationId: recommendationId ?? undefined,
          kind,
          note: note.trim() || undefined,
          context: {
            merchantLabel: merchantLabel ?? null,
            resolvedCategory,
            bestCardName: bestCard?.name ?? null,
            bestCardIssuer: bestCard?.issuer ?? null,
          },
        }),
      });
      setMsg("Thanks — we logged that for review.");
      setNote("");
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Could not send report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SurfaceCard className="motion-enter overflow-hidden p-0 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.35)] dark:shadow-[0_28px_90px_-36px_rgba(0,0,0,0.65)]">
      <div className="relative border-b border-white/10 bg-gradient-to-br from-violet-600 via-blue-600 to-indigo-700 px-5 py-5 text-white sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_200px_at_20%_-40%,rgba(255,255,255,0.35),transparent)] opacity-90" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-100/90">
            Best card for this purchase
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {bestCard ? bestCard.name : "Add a card to get recommendations"}
          </h2>
          {bestCard && (
            <p className="mt-1 text-sm text-violet-50/90">
              {bestCard.issuer}
              {bestCard.last4 ? ` · ending ${bestCard.last4}` : ""}
            </p>
          )}
          {bestCardBenefits && (
            <p className="mt-3 text-base font-medium text-white/95">
              {bestCardBenefits.rateLabel}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 text-sm text-foreground/90 sm:px-6 sm:py-6">
        <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Spend context
          </p>
          <p className="mt-1 font-medium">
            {categoryLabel}
            {merchantLabel ? (
              <span className="text-muted-foreground"> · {merchantLabel}</span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Rankings compare reward rates and card perks for this category — not
            tied to a purchase amount.
          </p>
          {evaluationDate ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Rates as of{" "}
              {new Date(evaluationDate).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </div>

        {alternatesTied.length > 0 && (
          <StatusMessage variant="warning">
            Tie detected: multiple cards score the same effective rate.
          </StatusMessage>
        )}

        {bestCardBenefits && (
          <SurfaceCard className="border-violet-500/25 bg-violet-500/[0.04] p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
              <CreditCard className="size-3.5" />
              Why {bestCard?.name ?? "this card"}
            </p>
            <div className="mt-3">
              <BenefitsPanel benefits={bestCardBenefits} />
            </div>
          </SurfaceCard>
        )}

        {(trace.length > 0 || reasoning.length > 0) && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              How we classified this spend
            </p>
            <ul className="mt-2 space-y-1.5">
              {trace.map((t, i) => (
                <li key={`t-${i}`} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                  <span>{t}</span>
                </li>
              ))}
              {reasoning
                .filter(
                  (t) =>
                    !bestCardBenefits?.categoryEarnLines.some((l) =>
                      t.includes(l.slice(0, 12)),
                    ),
                )
                .map((t, i) => (
                  <li key={`r-${i}`} className="flex gap-2 text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    <span>{t}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {marketBest && (
          <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 to-card px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
              Best known catalog card (reference)
            </p>
            <p className="mt-1 font-medium">
              {marketBest.catalogName ?? marketBest.cardName}{" "}
              <span className="text-muted-foreground">({marketBest.issuer})</span>
            </p>
            <p className="mt-1 text-sm text-violet-700 dark:text-violet-300">
              {marketBest.rateLabel}
            </p>
            {marketBest.benefits && (
              <div className="mt-3 border-t border-blue-500/15 pt-3">
                <BenefitsPanel benefits={marketBest.benefits} compact />
              </div>
            )}
          </div>
        )}

        {ranked.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Every card in your wallet
            </p>
            <ol className="mt-3 space-y-3">
              {ranked.map((r, idx) => (
                <Fragment key={r.cardId}>
                  <li
                    className={`rounded-2xl border px-3 py-3 ${
                      idx === 0
                        ? "border-violet-400/40 bg-violet-500/[0.06]"
                        : "border-border/70 bg-card/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-start gap-2.5">
                        <CardThumbnail
                          name={r.cardName}
                          issuer={r.issuer}
                          last4={r.last4}
                          colorHex={r.colorHex}
                          size="xs"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground">{idx + 1}.</span>
                            <span className="font-medium">{r.cardName}</span>
                            {idx === 0 && (
                              <Badge className="bg-violet-600/15 text-violet-800 dark:text-violet-200">
                                Best
                              </Badge>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {r.issuer}
                          </span>
                          <span className="mt-1 block text-sm font-medium text-violet-700 dark:text-violet-300">
                            {r.rateLabel}
                          </span>
                        </span>
                      </span>
                    </div>
                    <div className="mt-3 border-t border-border/50 pt-3 pl-11">
                      <BenefitsPanel benefits={r.benefits} compact />
                    </div>
                  </li>
                  {r.catalogRotatingQuarters &&
                    r.catalogRotatingQuarters.length > 0 && (
                      <li className="ml-8 list-none border-l border-border pl-3 text-[11px] text-muted-foreground">
                        <p className="font-semibold">Rotating bonuses</p>
                        <ul className="mt-1 space-y-1">
                          {r.catalogRotatingQuarters.map((q, qi) => (
                            <li key={qi}>
                              <span>{q.label}</span>
                              {q.categories?.length ? (
                                <span className="ml-1 font-mono text-[10px]">
                                  · {q.categories.join(", ")} · {q.multiplier}%
                                </span>
                              ) : null}
                              <span className="mt-0.5 block text-[10px]">
                                {formatIsoRange(q.validFrom, q.validUntil)}
                              </span>
                              {q.details ? (
                                <span className="mt-0.5 block italic">{q.details}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </li>
                    )}
                </Fragment>
              ))}
            </ol>
          </div>
        )}

        {bestCard && (
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-card px-5 py-6">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
              <CardThumbnail
                name={bestCard.name}
                issuer={bestCard.issuer}
                last4={bestCard.last4}
                colorHex={bestCard.colorHex}
                size="lg"
                className="shadow-xl"
              />
              <div className="max-w-sm space-y-3 text-center sm:text-left">
                <p className="text-lg font-semibold leading-snug">
                  Use this card at checkout
                </p>
                <p className="font-mono text-4xl font-bold tracking-[0.15em]">
                  •••• {bestCard.last4 ?? "····"}
                </p>
              </div>
            </div>
            {bestCard.last4 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void copyLast4()}
                className="mt-6 w-full gap-2"
              >
                {copied ? (
                  <>
                    <Check className="size-4" />
                    Copied last 4 digits
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Copy last 4 digits
                  </>
                )}
              </Button>
            ) : null}
          </div>
        )}

        <div className="rounded-2xl border border-border/80 bg-muted/40/80 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Something look wrong?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MISMATCH_OPTIONS.map((o) => (
              <Button
                key={o.kind}
                type="button"
                variant="pill"
                size="pill"
                disabled={busy}
                onClick={() => void submit(o.kind)}
              >
                {o.label}
              </Button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <Label className="text-xs text-muted-foreground">Optional note</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. terminal showed grocery, not dining…"
            />
          </div>
          {msg && (
            <p className="mt-2 text-xs font-medium text-violet-700 dark:text-violet-300">
              {msg}
            </p>
          )}
          {err && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{err}</p>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
