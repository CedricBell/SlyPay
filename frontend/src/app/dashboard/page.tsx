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
    return <p className="text-red-600">{err}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Home</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {email ? (
            <>
              Signed in as <span className="font-medium">{email}</span>
            </>
          ) : (
            "Loading…"
          )}
        </p>
        <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Use SlyPay as a decision assistant at purchase time: detect nearby
          merchants, run a recommendation, and keep your wallet rules updated.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-500">Cards configured</p>
          <p className="mt-2 text-3xl font-semibold">{cards}</p>
          <Link href="/cards" className="mt-3 inline-block text-sm font-medium text-emerald-600">
            Manage cards →
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-500">Fast recommendation</p>
          <p className="mt-2 text-lg font-semibold">Use nearby mode in-store</p>
          <p className="mt-1 text-xs text-zinc-500">Location + merchant matching + explainable choice.</p>
          <Link href="/recommend" className="mt-3 inline-block text-sm font-medium text-emerald-600">
            Open now →
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-500">Recent runs</p>
          <p className="mt-2 text-3xl font-semibold">{recentRecs.length}</p>
          <p className="mt-1 text-xs text-zinc-500">Latest recommendation traces</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Last recommendations</h2>
          <Link href="/recommend" className="text-sm font-medium text-emerald-600">
            New recommendation
          </Link>
        </div>
        {recentRecs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No recommendations yet. Run one from the Now tab.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentRecs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-100">
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

      <div className="mt-1 flex flex-wrap gap-3">
        <Link
          href="/recommend"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Recommend now
        </Link>
        <Link
          href="/cards"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Update wallet rules
        </Link>
      </div>
    </div>
  );
}
