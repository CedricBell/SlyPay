"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="spending">Spending</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Period</span>
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}

      {loading && !stats && <Skeleton className="h-24 w-full" />}

      {stats && (
        <>
          {tab === "overview" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Total spend",
                  value: fmt.format(stats.transactions.totalSpend),
                  hint: `Last ${stats.periodDays} days`,
                },
                {
                  label: "Transactions",
                  value: String(stats.transactions.count),
                  hint: `Avg ticket ${fmtDetail.format(stats.transactions.avgTicket)}`,
                },
                {
                  label: "Wallet",
                  value: `${stats.wallet.activeCards} / ${stats.wallet.cards}`,
                  hint: "Active vs total cards",
                },
                {
                  label: "Recommendations run",
                  value: String(stats.recommendations.count),
                  hint: `Volume checked ${fmt.format(stats.recommendations.totalAmountConsidered)}`,
                },
              ].map((stat) => (
                <SurfaceCard key={stat.label} className="p-5">
                  <CardHeader className="p-0">
                    <CardDescription className="text-xs uppercase tracking-wide">
                      {stat.label}
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {stat.value}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pt-2">
                    <CardDescription className="text-xs">{stat.hint}</CardDescription>
                  </CardContent>
                </SurfaceCard>
              ))}
            </div>
          )}

          {tab === "overview" && stats.transactions.count === 0 && (
            <SurfaceCard className="border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground dark:text-foreground">
                No transactions in this period yet
              </p>
              <p className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground">
                Log purchases via the API or use recommendations to model spend.
                The dashboard becomes much richer once transactions exist.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button variant="gradient" asChild>
                  <Link href="/dashboard#nearby">Run a recommendation</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/cards">Manage cards</Link>
                </Button>
              </div>
            </SurfaceCard>
          )}

          {tab === "spending" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <SurfaceCard className="p-5">
                <h2 className="text-sm font-semibold text-foreground dark:text-foreground">
                  Spend by category
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  From recorded transactions (category on each row).
                </p>
                <ul className="mt-4 space-y-3">
                  {stats.spendByCategory.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No data</li>
                  ) : (
                    stats.spendByCategory.map((row) => (
                      <li key={row.category}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground dark:text-foreground">
                            {row.category.replaceAll("_", " ")}
                          </span>
                          <span className="text-muted-foreground dark:text-muted-foreground">
                            {fmt.format(row.amount)}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({row.count})
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/50">
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
              </SurfaceCard>

              <SurfaceCard className="p-5">
                <h2 className="text-sm font-semibold text-foreground dark:text-foreground">
                  Top merchants
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aggregated from transactions linked to merchants (or notes).
                </p>
                <ul className="mt-4 divide-y divide-border">
                  {stats.topMerchants.length === 0 ? (
                    <li className="py-3 text-sm text-muted-foreground">No data</li>
                  ) : (
                    stats.topMerchants.map((m, idx) => (
                      <li
                        key={`${m.label}-${idx}`}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <span className="font-medium text-foreground dark:text-foreground">
                          {m.label}
                        </span>
                        <span className="text-muted-foreground dark:text-muted-foreground">
                          {fmt.format(m.amount)}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {m.count}×
                          </span>
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </SurfaceCard>

              <SurfaceCard className="p-5 lg:col-span-2">
                <h2 className="text-sm font-semibold text-foreground dark:text-foreground">
                  Daily spend
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sum of transaction amounts per day in the selected window.
                </p>
                {stats.spendByDay.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="mt-4 flex h-36 items-end gap-1 border-b border-border pb-1 dark:border-border">
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
                          <span className="mt-1 hidden truncate text-[10px] text-muted-foreground sm:block">
                            {d.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SurfaceCard>

              {stats.transactions.largestPurchase.amount > 0 && (
                <SurfaceCard className="p-5 lg:col-span-2">
                  <h2 className="text-sm font-semibold text-foreground dark:text-foreground">
                    Largest purchase
                  </h2>
                  <p className="mt-2 text-2xl font-semibold">
                    {fmtDetail.format(stats.transactions.largestPurchase.amount)}
                  </p>
                  {stats.transactions.largestPurchase.at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(
                        stats.transactions.largestPurchase.at,
                      ).toLocaleString()}
                    </p>
                  )}
                </SurfaceCard>
              )}
            </div>
          )}

          {tab === "recommendations" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <SurfaceCard className="p-5">
                <h2 className="text-sm font-semibold text-foreground dark:text-foreground">
                  Recommendations by resolved category
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  How often each spend category was resolved when you ran the
                  engine.
                </p>
                <ul className="mt-4 space-y-3">
                  {stats.recommendations.byCategory.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No runs in this period</li>
                  ) : (
                    stats.recommendations.byCategory.map((row) => (
                      <li key={row.category}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground dark:text-foreground">
                            {row.category.replaceAll("_", " ")}
                          </span>
                          <span className="text-muted-foreground dark:text-muted-foreground">
                            {row.count} runs
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/50">
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
              </SurfaceCard>
              <SurfaceCard className="p-5">
                <h2 className="text-sm font-semibold text-foreground dark:text-foreground">
                  How to use this for optimization
                </h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground dark:text-muted-foreground">
                  <li>
                    Compare <strong>spend by category</strong> (transactions) with{" "}
                    <strong>where the engine thinks you shop</strong> (recommendation
                    runs).
                  </li>
                  <li>
                    Keep card rules up to date on{" "}
                    <Link href="/cards" className="font-medium text-violet-600">
                      My cards
                    </Link>{" "}
                    so recommendations match your real wallet.
                  </li>
                  <li>
                    Run{" "}
                    <Link
                      href="/dashboard#nearby"
                      className="font-medium text-violet-600"
                    >
                      Recommendations
                    </Link>{" "}
                    before big purchases to pick the best card for that category.
                  </li>
                </ul>
              </SurfaceCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}
