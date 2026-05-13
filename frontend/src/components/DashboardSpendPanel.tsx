"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";

type Stats = {
  periodDays: number;
  since: string;
  wallet: { cards: number; activeCards: number };
  transactions: {
    count: number;
    totalSpend: number;
    avgTicket: number;
    largestPurchase: { amount: number; at: string | null };
  };
  spendByCategory: Array<{ category: string; amount: number; count: number }>;
  topMerchants: Array<{ label: string; amount: number; count: number }>;
  spendByDay: Array<{ date: string; amount: number }>;
  recommendations: {
    count: number;
    totalAmountConsidered: number;
    byCategory: Array<{ category: string; count: number }>;
  };
};

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const fmtDetail = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

type Tab = "overview" | "spending" | "recommendations";

export function DashboardSpendPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch<Stats>(`/dashboard/stats?days=${days}`);
      setStats(data);
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(formatCaughtApiError(e));
      } else {
        setErr("Could not load statistics");
      }
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxCat =
    stats?.spendByCategory.reduce((m, r) => Math.max(m, r.amount), 0) ?? 0;
  const maxDay = stats?.spendByDay.reduce((m, r) => Math.max(m, r.amount), 0) ?? 0;
  const maxRec =
    stats?.recommendations.byCategory.reduce((m, r) => Math.max(m, r.count), 0) ??
    0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
          {(
            [
              ["overview", "Overview"],
              ["spending", "Spending"],
              ["recommendations", "Recommendations"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Period</span>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 font-medium ${
                days === d
                  ? "bg-violet-600 text-white"
                  : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      )}

      {loading && !stats && (
        <p className="text-sm text-zinc-500">Loading statistics…</p>
      )}

      {stats && (
        <>
          {tab === "overview" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Total spend
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {fmt.format(stats.transactions.totalSpend)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Last {stats.periodDays} days
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Transactions
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.transactions.count}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Avg ticket {fmtDetail.format(stats.transactions.avgTicket)}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Wallet
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.wallet.activeCards}{" "}
                  <span className="text-base font-normal text-zinc-500">
                    / {stats.wallet.cards} cards
                  </span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">Active vs total</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Recommendations run
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.recommendations.count}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Volume checked{" "}
                  {fmt.format(stats.recommendations.totalAmountConsidered)}
                </p>
              </div>
            </div>
          )}

          {tab === "overview" && stats.transactions.count === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                No transactions in this period yet
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Log purchases via the API or use recommendations to model spend.
                The dashboard becomes much richer once transactions exist.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link
                  href="/recommend"
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Run a recommendation
                </Link>
                <Link
                  href="/cards"
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
                >
                  Manage cards
                </Link>
              </div>
            </div>
          )}

          {tab === "spending" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Spend by category
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  From recorded transactions (category on each row).
                </p>
                <ul className="mt-4 space-y-3">
                  {stats.spendByCategory.length === 0 ? (
                    <li className="text-sm text-zinc-500">No data</li>
                  ) : (
                    stats.spendByCategory.map((row) => (
                      <li key={row.category}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                            {row.category.replaceAll("_", " ")}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-300">
                            {fmt.format(row.amount)}{" "}
                            <span className="text-xs text-zinc-400">
                              ({row.count})
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{
                              width: `${maxCat ? Math.round((row.amount / maxCat) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Top merchants
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Aggregated from transactions linked to merchants (or notes).
                </p>
                <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {stats.topMerchants.length === 0 ? (
                    <li className="py-3 text-sm text-zinc-500">No data</li>
                  ) : (
                    stats.topMerchants.map((m, idx) => (
                      <li
                        key={`${m.label}-${idx}`}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-100">
                          {m.label}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {fmt.format(m.amount)}
                          <span className="ml-2 text-xs text-zinc-400">
                            {m.count}×
                          </span>
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Daily spend
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Sum of transaction amounts per day in the selected window.
                </p>
                {stats.spendByDay.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500">No data</p>
                ) : (
                  <div className="mt-4 flex h-36 items-end gap-1 border-b border-zinc-100 pb-1 dark:border-zinc-800">
                    {stats.spendByDay.map((d) => {
                      const barPx = maxDay
                        ? Math.max(4, Math.round((d.amount / maxDay) * 120))
                        : 4;
                      return (
                        <div
                          key={d.date}
                          className="group flex min-w-0 flex-1 flex-col items-center justify-end"
                          title={`${d.date}: ${fmtDetail.format(d.amount)}`}
                        >
                          <div
                            className="w-full max-w-[12px] rounded-t bg-violet-500/90 transition group-hover:bg-violet-400"
                            style={{ height: `${barPx}px` }}
                          />
                          <span className="mt-1 hidden truncate text-[10px] text-zinc-400 sm:block">
                            {d.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {stats.transactions.largestPurchase.amount > 0 && (
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Largest purchase
                  </h2>
                  <p className="mt-2 text-2xl font-semibold">
                    {fmtDetail.format(stats.transactions.largestPurchase.amount)}
                  </p>
                  {stats.transactions.largestPurchase.at && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(
                        stats.transactions.largestPurchase.at,
                      ).toLocaleString()}
                    </p>
                  )}
                </section>
              )}
            </div>
          )}

          {tab === "recommendations" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Recommendations by resolved category
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  How often each spend category was resolved when you ran the
                  engine.
                </p>
                <ul className="mt-4 space-y-3">
                  {stats.recommendations.byCategory.length === 0 ? (
                    <li className="text-sm text-zinc-500">No runs in this period</li>
                  ) : (
                    stats.recommendations.byCategory.map((row) => (
                      <li key={row.category}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                            {row.category.replaceAll("_", " ")}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-300">
                            {row.count} runs
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{
                              width: `${maxRec ? Math.round((row.count / maxRec) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  How to use this for optimization
                </h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>
                    Compare <strong>spend by category</strong> (transactions) with{" "}
                    <strong>where the engine thinks you shop</strong> (recommendation
                    runs).
                  </li>
                  <li>
                    Keep card rules up to date on{" "}
                    <Link href="/cards" className="font-medium text-violet-600">
                      Cards
                    </Link>{" "}
                    so recommendations match your real wallet.
                  </li>
                  <li>
                    Run{" "}
                    <Link
                      href="/recommend"
                      className="font-medium text-violet-600"
                    >
                      Recommendations
                    </Link>{" "}
                    before big purchases to pick the best card for that category.
                  </li>
                </ul>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
