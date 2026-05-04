"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

type Ranked = {
  cardId: string;
  cardName: string;
  issuer: string;
  comparableValue: number;
  effectiveMultiplier: number;
  earningType: string;
};

export type MismatchKind =
  | "WRONG_MERCHANT"
  | "WRONG_CATEGORY"
  | "REWARD_MISMATCH"
  | "WRONG_CARD_IN_PRACTICE"
  | "OTHER";

type Props = {
  amount: number;
  resolvedCategory: string;
  bestCard: { name: string; issuer: string; last4: string | null } | null;
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
  const [payExpanded, setPayExpanded] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [walletPlatform, setWalletPlatform] = useState<WalletPlatform>("other");

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setWalletPlatform("ios");
    else if (/Android/.test(ua)) setWalletPlatform("android");
  }, []);

  useEffect(() => {
    setPayExpanded(false);
  }, [recommendationId, amount, bestCard?.name]);

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
      if (e instanceof ApiError) setErr(e.body || e.message);
      else setErr("Could not send report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="motion-enter overflow-hidden rounded-3xl border border-zinc-200/80 bg-[var(--surface)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/70 dark:shadow-[0_28px_90px_-36px_rgba(0,0,0,0.65)]">
      <div className="relative border-b border-white/10 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-5 py-5 text-white sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_200px_at_20%_-40%,rgba(255,255,255,0.35),transparent)] opacity-90" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100/90">
            Best card for this purchase
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {bestCard ? bestCard.name : "Add a card to get recommendations"}
          </h2>
          {bestCard && (
            <p className="mt-1 text-sm text-emerald-50/90">
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
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{t}</span>
              </li>
            ))}
            {reasoning.map((t, i) => (
              <li key={`r-${i}`} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {marketBest && (
          <div className="rounded-2xl border border-sky-300/50 bg-gradient-to-br from-sky-50 to-white px-4 py-4 dark:border-sky-900/60 dark:from-sky-950/50 dark:to-zinc-950/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
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
                <li
                  key={r.cardId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/70 bg-white/60 px-3 py-2.5 transition hover:border-emerald-300/50 dark:border-zinc-800/80 dark:bg-zinc-900/30 dark:hover:border-emerald-900/40"
                >
                  <span className="min-w-0">
                    <span className="text-zinc-400">{idx + 1}. </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {r.cardName}
                    </span>{" "}
                    <span className="text-zinc-500">({r.issuer})</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    {r.effectiveMultiplier}x · {r.comparableValue.toFixed(2)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {bestCard && (
          <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white px-4 py-4 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-zinc-950/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
              Pay at the terminal
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Browsers cannot open Apple Pay or Google Pay with a specific card
              pre-selected for tap-to-pay — pick the card ending in{" "}
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {bestCard.last4 ?? "····"}
              </span>{" "}
              when your phone prompts you.
            </p>
            {!payExpanded ? (
              <button
                type="button"
                onClick={() => setPayExpanded(true)}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.99]"
              >
                I&apos;m using this card — show wallet steps
              </button>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-white/30 bg-white/70 px-4 py-3 text-center dark:border-emerald-900/40 dark:bg-zinc-950/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Select this card in your wallet
                  </p>
                  <p className="mt-1 font-mono text-3xl font-semibold tracking-widest text-zinc-900 dark:text-zinc-50">
                    •••• {bestCard.last4 ?? "····"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {bestCard.name} · {bestCard.issuer}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {bestCard.last4 ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(bestCard.last4!);
                          setCopyMsg("Last 4 copied.");
                          setTimeout(() => setCopyMsg(null), 2000);
                        } catch {
                          setCopyMsg("Could not copy — note the digits above.");
                          setTimeout(() => setCopyMsg(null), 2500);
                        }
                      }}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Copy last 4 digits
                    </button>
                  ) : null}
                  {walletPlatform === "android" ? (
                    <a
                      href="https://wallet.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Open Google Wallet
                    </a>
                  ) : null}
                </div>

                {walletPlatform === "ios" ? (
                  <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    <li>
                      Double-click the side button (or Home + Side on older
                      models) to bring up Wallet / Apple Pay.
                    </li>
                    <li>
                      Swipe or tap your cards until you see one ending in{" "}
                      <span className="font-mono">{bestCard.last4 ?? "····"}</span>.
                    </li>
                    <li>
                      Authenticate with Face ID / Touch ID, then hold near the
                      reader.
                    </li>
                  </ol>
                ) : walletPlatform === "android" ? (
                  <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    <li>Open Google Wallet (shortcut above if installed).</li>
                    <li>
                      Tap to pay — choose the card ending in{" "}
                      <span className="font-mono">{bestCard.last4 ?? "····"}</span>{" "}
                      if prompted.
                    </li>
                    <li>Hold the back of your phone to the terminal.</li>
                  </ol>
                ) : (
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    On your phone, open your wallet app and select the matching
                    card before tapping to pay.
                  </p>
                )}

                {copyMsg && (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {copyMsg}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setPayExpanded(false)}
                  className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  Collapse
                </button>
              </div>
            )}
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
                className="rounded-full border border-zinc-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition active:scale-[0.98] hover:border-emerald-400 hover:text-emerald-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-emerald-700 dark:hover:text-emerald-200"
              >
                {o.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Optional note
            <textarea
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. terminal showed grocery, not dining…"
            />
          </label>
          {msg && (
            <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {msg}
            </p>
          )}
          {err && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{err}</p>
          )}
        </div>
      </div>
    </div>
  );
}
