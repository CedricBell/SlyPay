"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [cards, setCards] = useState<number>(0);
  const [recentRecs, setRecentRecs] = useState<
    Array<{ id: string; merchantName: string | null; resolvedCategory: string; createdAt: string }>
  >([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ email: string }>("/auth/me");
        setEmail(me.email);
        const [wallet, recs] = await Promise.all([
          apiFetch<Array<{ id: string }>>("/cards"),
          apiFetch<
            Array<{
              id: string;
              merchantName: string | null;
              resolvedCategory: string;
              createdAt: string;
            }>
          >("/recommendations?limit=5"),
        ]);
        setCards(wallet.length);
        setRecentRecs(recs);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setErr("Could not load dashboard");
      }
    })();
  }, [router]);

  if (err) {
    return <p className="text-red-600 dark:text-red-400">{err}</p>;
  }

  return (
    <div className="motion-enter space-y-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Overview
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Home</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {email ? (
            <>
              Signed in as <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>
            </>
          ) : (
            "Loading…"
          )}
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Use SlyPay as a decision assistant at purchase time: detect nearby
          merchants, run a recommendation, and keep your wallet rules updated.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200/70 bg-[var(--surface)] p-5 shadow-md backdrop-blur-xl transition hover:border-emerald-300/40 dark:border-zinc-800/80 dark:hover:border-emerald-800/30">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Cards configured</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{cards}</p>
          <Link
            href="/cards"
            className="mt-4 inline-flex text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Manage cards →
          </Link>
        </div>
        <div className="rounded-3xl border border-zinc-200/70 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-5 shadow-md backdrop-blur-xl dark:border-zinc-800/80">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Fast recommendation</p>
          <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            In-store nearby mode
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Location + merchant matching + one-tap run when confidence is high.
          </p>
          <Link
            href="/recommend"
            className="mt-4 inline-flex text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Open now →
          </Link>
        </div>
        <div className="rounded-3xl border border-zinc-200/70 bg-[var(--surface)] p-5 shadow-md backdrop-blur-xl dark:border-zinc-800/80">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Recent runs</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{recentRecs.length}</p>
          <p className="mt-1 text-xs text-zinc-500">Latest recommendation traces</p>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200/70 bg-[var(--surface)] p-5 shadow-md backdrop-blur-xl dark:border-zinc-800/80 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Last recommendations</h2>
          <Link
            href="/recommend"
            className="text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            New recommendation
          </Link>
        </div>
        {recentRecs.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No recommendations yet. Run one from the Now tab.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentRecs.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {r.merchantName ?? "Unknown merchant"}
                </span>
                <span className="text-zinc-500">
                  {r.resolvedCategory.replaceAll("_", " ")} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/recommend"
          className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
        >
          Recommend now
        </Link>
        <Link
          href="/cards"
          className="rounded-2xl border border-zinc-300/80 bg-white/60 px-5 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-white dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Update wallet rules
        </Link>
      </div>
    </div>
  );
}
