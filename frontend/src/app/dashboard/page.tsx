"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ email: string }>("/auth/me");
        setEmail(me.email);
        const cards = await apiFetch<unknown[]>("/cards");
        setCardCount(cards.length);
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
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {email ? (
            <>
              Signed in as <span className="font-medium">{email}</span>
            </>
          ) : (
            "Loading…"
          )}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-500">Cards on file</p>
          <p className="mt-2 text-3xl font-semibold">
            {cardCount === null ? "—" : cardCount}
          </p>
          <Link
            href="/cards"
            className="mt-4 inline-block text-sm font-medium text-emerald-600"
          >
            Manage cards →
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-500">Next step</p>
          <p className="mt-2 text-lg font-medium">Run a recommendation</p>
          <Link
            href="/recommend"
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Where are you shopping?
          </Link>
        </div>
      </div>
    </div>
  );
}
