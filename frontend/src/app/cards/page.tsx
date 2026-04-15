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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Your cards</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Rules attach to each card; offers can temporarily override categories.
          </p>
        </div>
        <Link
          href="/cards/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Add card
        </Link>
      </div>
      {err && <p className="text-red-600">{err}</p>}
      <ul className="space-y-3">
        {cards.map((c) => (
          <li key={c.id}>
            <Link
              href={`/cards/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
              style={{ borderLeftWidth: 4, borderLeftColor: c.colorHex ?? "#0f172a" }}
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-zinc-500">
                  {c.issuer}
                  {c.last4 ? ` · •••• ${c.last4}` : ""}
                </p>
              </div>
              <span className="text-sm text-emerald-600">Edit →</span>
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
