"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CardThumbnail } from "@/components/CardThumbnail";
import { apiFetch, ApiError } from "@/lib/api";

type WalletScoreBreakdown = {
  statementCredits: number;
  earnStructure: number;
  rewardRules: number;
  annualFeePenalty: number;
};

type WalletPreview = {
  ruleHighlights: string[];
  pdfSummary: string | null;
  statementCreditHints: string[];
  scoreBreakdown: WalletScoreBreakdown;
};

type CardRow = {
  id: string;
  name: string;
  issuer: string;
  last4: string | null;
  colorHex: string | null;
  isActive: boolean;
  catalogLinked: boolean;
  catalogSlug: string | null;
  hasOfficialPdfExtract: boolean;
  officialDocumentUrl: string | null;
  walletScore: number;
  walletPreview: WalletPreview;
};

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiFetch<CardRow[]>("/cards");
        setCards(c);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setErr("Failed to load cards");
      }
    })();
  }, [router]);

  const ranked = useMemo(
    () => [...cards].sort((a, b) => b.walletScore - a.walletScore),
    [cards],
  );

  return (
    <div className="motion-enter space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
            Wallet
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your cards</h1>
          <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Classement indicatif d’après tes{" "}
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              RewardRule
            </strong>{" "}
            et, si la carte est liée au catalogue, un aperçu issu du{" "}
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              dernier extrait PDF
            </strong>{" "}
            validé côté admin (crédits / résumé). Ce n’est pas un conseil financier.
          </p>
        </div>
        <Link
          href="/cards/new"
          className="rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.98]"
        >
          Add card
        </Link>
      </div>
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      {ranked.length > 1 && (
        <section className="rounded-3xl border border-zinc-200/80 bg-[var(--surface)] p-5 shadow-sm dark:border-zinc-800/80">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Aperçu classement
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Score interne (earn hors « OTHER » + bonus si extrait PDF présent + nombre de
            crédits mentionnés dans l’extrait). Pour des règles exactes à jour : valider une
            proposition dans{" "}
            <Link href="/admin/card-catalog" className="text-violet-700 underline dark:text-violet-400">
              Admin → Catalogue
            </Link>
            .
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {ranked.map((c, i) => (
              <li
                key={c.id}
                className="flex items-start gap-3 rounded-2xl border border-zinc-200/60 bg-white/40 px-3 py-3 dark:border-zinc-800/60 dark:bg-zinc-950/30"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/15 text-sm font-bold text-violet-800 dark:text-violet-300">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                  <p className="text-xs text-zinc-500">{c.issuer}</p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {c.walletPreview.ruleHighlights[0] ?? "—"} · score{" "}
                    <strong>{c.walletScore}</strong>
                      <span className="text-zinc-500">
                        {" "}
                        (crédits {c.walletPreview.scoreBreakdown.statementCredits}{" "}
                        · earn {c.walletPreview.scoreBreakdown.earnStructure} ·
                        règles {c.walletPreview.scoreBreakdown.rewardRules}
                        {c.walletPreview.scoreBreakdown.annualFeePenalty !== 0
                          ? ` · frais ${c.walletPreview.scoreBreakdown.annualFeePenalty}`
                          : ""}
                        )
                      </span>
                  </p>
                  {c.walletPreview.statementCreditHints.length > 0 && (
                    <p className="mt-1 line-clamp-2 text-xs text-amber-800/90 dark:text-amber-200/90">
                      Crédits (extrait) : {c.walletPreview.statementCreditHints.slice(0, 2).join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ul className="space-y-3">
        {cards.map((c) => (
          <li key={c.id}>
            <Link
              href={`/cards/${c.id}`}
              className="flex flex-col gap-3 rounded-3xl border border-zinc-200/70 bg-[var(--surface)] px-4 py-4 shadow-sm backdrop-blur-xl transition hover:border-violet-400/35 hover:shadow-md active:scale-[0.99] dark:border-zinc-800/80 dark:hover:border-violet-800/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <CardThumbnail
                  name={c.name}
                  issuer={c.issuer}
                  last4={c.last4}
                  colorHex={c.colorHex}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{c.name}</p>
                  <p className="text-sm text-zinc-500">
                    {c.issuer}
                    {c.last4 ? ` · •••• ${c.last4}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.catalogLinked ? (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
                        Catalogue
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                        Manuel
                      </span>
                    )}
                    {c.hasOfficialPdfExtract && (
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">
                        PDF extrait
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1 border-t border-zinc-200/60 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 dark:border-zinc-800/60">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Points forts (règles)
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                  {c.walletPreview.ruleHighlights.length ? (
                    c.walletPreview.ruleHighlights.map((line) => (
                      <li key={line}>{line}</li>
                    ))
                  ) : (
                    <li className="text-zinc-500">Aucune règle</li>
                  )}
                </ul>
                {c.walletPreview.statementCreditHints.length > 0 && (
                  <>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      Cotisations / crédits (aperçu extrait)
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-amber-900/90 dark:text-amber-100/80">
                      {c.walletPreview.statementCreditHints.slice(0, 4).map((line) => (
                        <li key={line} className="line-clamp-2">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {c.walletPreview.pdfSummary && (
                  <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                    {c.walletPreview.pdfSummary}
                  </p>
                )}
              </div>
              <span className="shrink-0 self-end text-sm font-semibold text-violet-600 dark:text-violet-400 sm:self-center">
                Edit →
              </span>
            </Link>
          </li>
        ))}
        {!cards.length && !err && (
          <p className="text-sm text-zinc-500">No cards yet.</p>
        )}
      </ul>
    </div>
  );
}
