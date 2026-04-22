"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";

type CardRow = {
  id: string;
  name: string;
  issuer: string;
  last4: string | null;
  colorHex: string | null;
  isActive: boolean;
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

  return (
    <div className="motion-enter space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            Wallet
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your cards</h1>
          <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Rules attach to each card; offers can temporarily override categories.
          </p>
        </div>
        <Link
          href="/cards/new"
          className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.98]"
        >
          Add card
        </Link>
      </div>
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      <ul className="space-y-3">
        {cards.map((c) => (
          <li key={c.id}>
            <Link
              href={`/cards/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-3xl border border-zinc-200/70 bg-[var(--surface)] px-4 py-4 shadow-sm backdrop-blur-xl transition hover:border-emerald-400/35 hover:shadow-md active:scale-[0.99] dark:border-zinc-800/80 dark:hover:border-emerald-800/30"
              style={{ borderLeftWidth: 4, borderLeftColor: c.colorHex ?? "#0f172a" }}
            >
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">{c.name}</p>
                <p className="text-sm text-zinc-500">
                  {c.issuer}
                  {c.last4 ? ` · •••• ${c.last4}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
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
