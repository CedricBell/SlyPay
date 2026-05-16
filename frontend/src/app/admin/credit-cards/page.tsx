"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";

type IntelJob = {
  status: string;
  createdAt: string;
  finishedAt: string | null;
  errorSnippet: string | null;
};

type ScoreBreakdown = {
  grossRewardsUsd: number;
  statementCreditsUsd: number;
  annualFeeUsd: number;
  netValueUsd: number;
  scoreOutOf100: number;
  spendProfileLabel: string;
};

type Row = {
  id: string;
  userId: string;
  userEmail: string;
  name: string;
  issuer: string;
  last4: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  catalogProductSlug: string | null;
  catalogProductName: string | null;
  officialDocumentUrl: string | null;
  hasCatalogExtract: boolean;
  catalogLastFetchedAt: string | null;
  rewardRuleCount: number;
  walletScore: number;
  walletScoreBreakdown: ScoreBreakdown;
  rulePreview: string[];
  latestIntelJob: IntelJob | null;
};

type ListRes = {
  items: Row[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

type KnownIssuerRow = {
  apexDomain: string;
  displayName: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

function jobStatusClass(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "text-emerald-700 dark:text-emerald-400";
    case "FAILED":
      return "text-red-700 dark:text-red-400";
    case "RUNNING":
    case "PENDING":
      return "text-amber-700 dark:text-amber-400";
    case "SKIPPED_NO_SOURCE":
      return "text-zinc-500";
    default:
      return "text-zinc-600";
  }
}

export default function AdminCreditCardsPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [knownIssuers, setKnownIssuers] = useState<KnownIssuerRow[] | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch<ListRes>(
        `/admin/credit-cards?page=${page}&limit=50`,
      );
      setData(res);
      try {
        setKnownIssuers(
          await apiFetch<KnownIssuerRow[]>(`/admin/known-issuers`),
        );
      } catch {
        setKnownIssuers([]);
      }
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Erreur de chargement");
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data && !err) {
    return <p className="text-sm text-zinc-500">Chargement…</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Toutes les cartes (base de données)
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {data?.total ?? "—"} carte(s) — cliquez sur Rafraîchir pour recharger
            depuis la base.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-600"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {err && (
        <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </pre>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-3 py-2 font-medium">Utilisateur</th>
              <th className="px-3 py-2 font-medium">Carte</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Catalogue</th>
              <th className="px-3 py-2 font-medium">Source Web</th>
              <th className="px-3 py-2 font-medium">Règles</th>
              <th className="px-3 py-2 font-medium">Job intel</th>
              <th className="px-3 py-2 font-medium">Actif</th>
              <th className="px-3 py-2 font-medium">Màj</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((r) => (
              <tr
                key={r.id}
                className="border-b border-zinc-100 align-top dark:border-zinc-800"
              >
                <td className="px-3 py-2">
                  <p className="max-w-[200px] truncate font-mono text-xs">
                    {r.userEmail}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
                    {r.id.slice(0, 12)}…
                  </p>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {r.name}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {r.issuer}
                    {r.last4 ? ` · ${r.last4}` : ""}
                  </p>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.rewardRuleCount === 0 ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <>
                      <span className="text-lg font-semibold text-violet-700 dark:text-violet-300">
                        {r.walletScore}
                        <span className="text-sm font-normal text-zinc-500">/100</span>
                      </span>
                      <p
                        className="mt-1 max-w-[160px] text-[10px] leading-snug text-zinc-500"
                        title={`Rewards $${r.walletScoreBreakdown.grossRewardsUsd} + crédits $${r.walletScoreBreakdown.statementCreditsUsd}/mo · frais $${r.walletScoreBreakdown.annualFeeUsd}/an · net $${r.walletScoreBreakdown.netValueUsd}/mo`}
                      >
                        net ${r.walletScoreBreakdown.netValueUsd.toFixed(2)}/mo
                        {r.walletScoreBreakdown.annualFeeUsd > 0 && (
                          <>
                            {" "}
                            · frais ${r.walletScoreBreakdown.annualFeeUsd}/an
                          </>
                        )}
                      </p>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.catalogProductSlug ? (
                    <>
                      <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono dark:bg-zinc-900">
                        {r.catalogProductSlug}
                      </code>
                      {r.catalogProductName && (
                        <p className="mt-1 max-w-[180px] text-zinc-500">
                          {r.catalogProductName}
                        </p>
                      )}
                      {r.hasCatalogExtract ? (
                        <span className="mt-1 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Extrait PDF
                        </span>
                      ) : (
                        <span className="mt-1 inline-block text-[10px] text-zinc-400">
                          Pas d&apos;extrait
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.officialDocumentUrl ? (
                    <a
                      href={r.officialDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                      title={r.officialDocumentUrl}
                    >
                      Web
                      <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-400">Aucune URL</span>
                  )}
                  {r.catalogLastFetchedAt && (
                    <p className="mt-1 text-[10px] text-zinc-500">
                      fetch{" "}
                      {new Date(r.catalogLastFetchedAt).toLocaleDateString()}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  <span className="font-semibold">{r.rewardRuleCount}</span>
                  {r.rulePreview.length > 0 && (
                    <ul className="mt-1 max-w-[220px] space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                      {r.rulePreview.map((line, idx) => (
                        <li key={`${r.id}-r${idx}`} className="truncate" title={line}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.latestIntelJob ? (
                    <>
                      <span
                        className={`font-semibold ${jobStatusClass(r.latestIntelJob.status)}`}
                      >
                        {r.latestIntelJob.status}
                      </span>
                      {r.latestIntelJob.errorSnippet && (
                        <p
                          className="mt-1 max-w-[200px] text-[10px] text-red-600 dark:text-red-400"
                          title={r.latestIntelJob.errorSnippet}
                        >
                          {r.latestIntelJob.errorSnippet}
                          …
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.isActive ? (
                    <span className="text-emerald-600">oui</span>
                  ) : (
                    <span className="text-zinc-400">non</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-[11px] text-zinc-500">
                  {new Date(r.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-600"
          >
            Précédent
          </button>
          <span className="text-zinc-600">
            Page {data.page} / {data.pages}
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-600"
          >
            Suivant
          </button>
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Émetteurs appris (PDF intel)
        </h3>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Remplis automatiquement après un PDF valide ; les domaines servent aux
          prochaines recherches « site: » pour le même libellé.
        </p>
        {knownIssuers && knownIssuers.length === 0 && (
          <p className="mt-2 text-xs text-zinc-500">Aucune entrée pour l’instant.</p>
        )}
        {knownIssuers && knownIssuers.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Libellé</th>
                  <th className="px-3 py-2 font-medium">Domaine (apex)</th>
                  <th className="px-3 py-2 font-medium">Dernière vue</th>
                </tr>
              </thead>
              <tbody>
                {knownIssuers.map((k) => (
                  <tr
                    key={k.apexDomain}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {k.displayName}
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">
                      {k.apexDomain}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                      {new Date(k.lastSeenAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
