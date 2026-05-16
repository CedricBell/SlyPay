"use client";

import { Fragment, useEffect, useState } from "react";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";
import { CardThumbnail } from "@/components/CardThumbnail";

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
  comparableValue: number;
  effectiveMultiplier: number;
  earningType: string;
  last4?: string | null;
  colorHex?: string | null;
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

export type MismatchKind =
  | "WRONG_MERCHANT"
  | "WRONG_CATEGORY"
  | "REWARD_MISMATCH"
  | "WRONG_CARD_IN_PRACTICE"
  | "OTHER";

type Props = {
  amount: number;
  resolvedCategory: string;
  evaluationDate?: string | null;
  bestCard: {
    name: string;
    issuer: string;
    last4: string | null;
    colorHex?: string | null;
  } | null;
  reasoning: string[];
  ranked: Ranked[];
  alternatesTied: string[];
  trace: string[];
  marketBest: {
    cardId: string;
    cardName: string;
    issuer: string;
    comparableValue: number;
    effectiveMultiplier: number;
    earningType: string;
    deltaVsWalletBest: number;
  } | null;
  recommendationId?: string | null;
  merchantLabel?: string | null;
};

type WalletPlatform = "ios" | "android" | "other";

const MISMATCH_OPTIONS: { kind: MismatchKind; label: string }[] = [
  { kind: "WRONG_MERCHANT", label: "Wrong store" },
  { kind: "WRONG_CATEGORY", label: "Wrong category" },
  { kind: "REWARD_MISMATCH", label: "Reward didn’t match" },
  { kind: "WRONG_CARD_IN_PRACTICE", label: "Better card in practice" },
  { kind: "OTHER", label: "Other" },
];

export function RecommendationCard({
  amount,
  resolvedCategory,
  evaluationDate,
  bestCard,
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
  const [walletPlatform, setWalletPlatform] = useState<WalletPlatform>("other");
  const [payStripOpen, setPayStripOpen] = useState(false);
  const [payJustActivated, setPayJustActivated] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setWalletPlatform("ios");
    else if (/Android/.test(ua)) setWalletPlatform("android");
  }, []);

  useEffect(() => {
    setPayStripOpen(false);
    setPayJustActivated(false);
  }, [recommendationId, amount, bestCard?.name]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!payStripOpen) {
      document.body.style.paddingBottom = "";
      return;
    }
    document.body.style.paddingBottom = "5.75rem";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [payStripOpen]);

  const openWalletForPay = () => {
    if (typeof window === "undefined") return;

    if (walletPlatform === "android") {
      /**
       * Prefer resolving the installed Google Wallet app via intent: Chrome resolves
       * com.google.android.apps.walletnfcrel; falls back to the HTTPS wallet URL.
       * See https://developer.chrome.com/docs/android/intents
       */
      const fallback = encodeURIComponent("https://wallet.google.com/");
      const intent = `intent://wallet.google.com/#Intent;scheme=https;package=com.google.android.apps.walletnfcrel;S.browser_fallback_url=${fallback};end`;
      const a = document.createElement("a");
      a.href = intent;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    if (walletPlatform === "ios") {
      /**
       * Apple does not publish a stable public URL scheme to open Wallet from Safari.
       * Schemes like apple-wallet:// appear in blogs but are undocumented and often blocked.
       * Apple Pay on the Web uses Payment Request API for merchant checkout — different flow.
       */
      window.open("https://wallet.apple.com/", "_blank", "noopener,noreferrer");
    }
  };

  const payWithRecommendedCard = async () => {
    try {
      navigator.vibrate?.(12);
    } catch {
      /* optional */
    }

    if (!bestCard?.last4) {
      openWalletForPay();
      setPayStripOpen(true);
      setPayJustActivated(true);
      setTimeout(() => setPayJustActivated(false), 700);
      return;
    }
    try {
      await navigator.clipboard.writeText(bestCard.last4);
    } catch {
      /* still open wallet */
    }
    openWalletForPay();
    setPayStripOpen(true);
    setPayJustActivated(true);
    setTimeout(() => setPayJustActivated(false), 700);
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
            amount,
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
    <>
    <div className="motion-enter overflow-hidden rounded-3xl border border-zinc-200/80 bg-[var(--surface)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/70 dark:shadow-[0_28px_90px_-36px_rgba(0,0,0,0.65)]">
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
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 text-sm text-zinc-700 dark:text-zinc-200 sm:px-6 sm:py-6">
        <div className="rounded-2xl border border-zinc-200/60 bg-white/50 px-4 py-3 dark:border-zinc-800/80 dark:bg-zinc-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Context
          </p>
          <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
            ${amount.toFixed(2)} ·{" "}
            <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
              {resolvedCategory}
            </span>
            {evaluationDate ? (
              <span className="mt-1 block text-xs font-normal text-zinc-500">
                Rates as of{" "}
                {new Date(evaluationDate).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            ) : null}
            {merchantLabel ? (
              <span className="mt-1 block text-xs font-normal text-zinc-500">
                Merchant: {merchantLabel}
              </span>
            ) : null}
          </p>
        </div>

        {alternatesTied.length > 0 && (
          <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-50">
            Tie detected: multiple cards score the same. Showing deterministic
            winner; see ranking below.
          </p>
        )}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Why this card
          </p>
          <ul className="mt-2 space-y-1.5 text-zinc-700 dark:text-zinc-300">
            {trace.map((t, i) => (
              <li key={`t-${i}`} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>{t}</span>
              </li>
            ))}
            {reasoning.map((t, i) => (
              <li key={`r-${i}`} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {marketBest && (
          <div className="rounded-2xl border border-blue-300/50 bg-gradient-to-br from-blue-50 to-white px-4 py-4 dark:border-blue-900/60 dark:from-blue-950/50 dark:to-zinc-950/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
              Global catalog comparison
            </p>
            <p className="mt-1 text-zinc-800 dark:text-zinc-100">
              Best known catalog card for this spend:{" "}
              <span className="font-semibold">
                {marketBest.cardName} ({marketBest.issuer})
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {marketBest.effectiveMultiplier}x · score{" "}
              {marketBest.comparableValue.toFixed(2)}
            </p>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Gap vs your best wallet card:{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {marketBest.deltaVsWalletBest >= 0 ? "+" : ""}
                {marketBest.deltaVsWalletBest.toFixed(2)}
              </span>
            </p>
          </div>
        )}

        {ranked.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              All cards (ranked)
            </p>
            <ol className="mt-3 space-y-2">
              {ranked.map((r, idx) => (
                <Fragment key={r.cardId}>
                  <li className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/70 bg-white/60 px-2 py-2 pl-2 transition hover:border-violet-300/50 dark:border-zinc-800/80 dark:bg-zinc-900/30 dark:hover:border-violet-900/40">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <CardThumbnail
                        name={r.cardName}
                        issuer={r.issuer}
                        last4={r.last4}
                        colorHex={r.colorHex}
                        size="xs"
                      />
                      <span className="min-w-0">
                        <span className="text-zinc-400">{idx + 1}. </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {r.cardName}
                        </span>{" "}
                        <span className="text-zinc-500">({r.issuer})</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      {r.effectiveMultiplier}x · {r.comparableValue.toFixed(2)}
                    </span>
                  </li>
                  {r.catalogRotatingQuarters &&
                    r.catalogRotatingQuarters.length > 0 && (
                      <li className="ml-8 list-none border-l border-zinc-200 pl-3 text-[11px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        <p className="font-semibold text-zinc-600 dark:text-zinc-300">
                          Rotating / calendar bonuses (catalog)
                        </p>
                        <ul className="mt-1 space-y-1">
                          {r.catalogRotatingQuarters.map((q, qi) => (
                            <li key={qi}>
                              <span className="text-zinc-700 dark:text-zinc-200">
                                {q.label}
                              </span>
                              {q.categories?.length ? (
                                <span className="ml-1 font-mono text-[10px] text-zinc-500">
                                  · {q.categories.join(", ")} · {q.multiplier}%
                                </span>
                              ) : null}
                              <span className="mt-0.5 block text-[10px] text-zinc-500">
                                {formatIsoRange(q.validFrom, q.validUntil)}
                              </span>
                              {q.details ? (
                                <span className="mt-0.5 block italic text-zinc-500">
                                  {q.details}
                                </span>
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
          <div className="rounded-3xl border border-violet-200/70 bg-gradient-to-br from-violet-50/90 to-white px-5 py-6 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-zinc-950/40">
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
                <p className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                  {walletPlatform === "ios" && "Use this card in Apple Pay"}
                  {walletPlatform === "android" &&
                    "Use this card in Google Wallet"}
                  {walletPlatform === "other" &&
                    "Use this card in your wallet app"}
                </p>
                <p className="font-mono text-4xl font-bold tracking-[0.15em] text-zinc-900 dark:text-zinc-50">
                  •••• {bestCard.last4 ?? "····"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void payWithRecommendedCard()}
              className={`mt-6 w-full rounded-2xl bg-gradient-to-r from-[#000] to-zinc-800 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99] dark:from-zinc-800 dark:to-zinc-950 ${
                payJustActivated
                  ? "ring-4 ring-violet-400/90 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900"
                  : ""
              }`}
            >
              {walletPlatform === "ios" && "Open Apple Wallet"}
              {walletPlatform === "android" && "Open Google Wallet"}
              {walletPlatform === "other" && "Open wallet"}
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Something look wrong?
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Quick report helps us fix merchant mappings and reward logic.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MISMATCH_OPTIONS.map((o) => (
              <button
                key={o.kind}
                type="button"
                disabled={busy}
                onClick={() => void submit(o.kind)}
                className="rounded-full border border-zinc-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition active:scale-[0.98] hover:border-violet-400 hover:text-violet-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-violet-700 dark:hover:text-violet-200"
              >
                {o.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Optional note
            <textarea
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-violet-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. terminal showed grocery, not dining…"
            />
          </label>
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
    </div>

    {payStripOpen && bestCard ? (
      <div
        className="motion-enter fixed inset-x-0 bottom-0 z-[100] border-t border-violet-500/25 bg-[var(--surface)]/95 px-3 py-3 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.2)] backdrop-blur-xl dark:border-violet-900/30 dark:bg-zinc-950/95"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        role="status"
        aria-label="Card digits for checkout"
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <CardThumbnail
            name={bestCard.name}
            issuer={bestCard.issuer}
            last4={bestCard.last4}
            colorHex={bestCard.colorHex}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Same card
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums tracking-[0.2em] text-zinc-900 dark:text-zinc-50">
              •••• {bestCard.last4 ?? "····"}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {bestCard.name}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => void payWithRecommendedCard()}
              className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-violet-500 active:scale-[0.98]"
            >
              Open again
            </button>
            <button
              type="button"
              onClick={() => setPayStripOpen(false)}
              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
