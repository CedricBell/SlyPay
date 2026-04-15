"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MerchantInput } from "@/components/MerchantInput";
import { RecommendationCard } from "@/components/RecommendationCard";
import { WalletCardList } from "@/components/WalletCardList";
import { apiFetch, ApiError } from "@/lib/api";

type CardRow = {
  id: string;
  name: string;
  issuer: string;
  last4: string | null;
  colorHex: string | null;
  isActive: boolean;
};

type RecRes = {
  amount: number;
  resolvedCategory: string;
  categoryResolution: { trace: string[] };
  bestCard: {
    name: string;
    issuer: string;
    last4: string | null;
  } | null;
  reasoning: string[];
  ranked: Array<{
    cardId: string;
    cardName: string;
    issuer: string;
    comparableValue: number;
    effectiveMultiplier: number;
    earningType: string;
  }>;
  alternatesTied: string[];
};

export default function RecommendPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState("");
  const [mcc, setMcc] = useState("");
  const [amount, setAmount] = useState("42.5");
  const [cards, setCards] = useState<CardRow[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [result, setResult] = useState<RecRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiFetch<CardRow[]>("/cards");
        setCards(c);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
        }
      }
    })();
  }, [router]);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        amount: Number(amount),
        merchantName: merchant || undefined,
        mcc: mcc.replace(/\D/g, "").slice(0, 4) || undefined,
        persist: true,
      };
      const res = await apiFetch<RecRes>("/recommendation", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(res);
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(e.body || e.message);
      } else setErr("Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Recommendation</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Enter merchant and amount. Category resolves from merchant records,
          MCC hints, or falls back to OTHER.
        </p>
      </div>

      <form onSubmit={run} className="space-y-6">
        <MerchantInput
          value={merchant}
          onChange={setMerchant}
          onPick={(m) => {
            if (m.mcc) setMcc(m.mcc);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Amount (USD)
            </label>
            <input
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              MCC override (optional)
            </label>
            <input
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="e.g. 5411"
              value={mcc}
              onChange={(e) => setMcc(e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Highlight a card (optional)
          </p>
          <WalletCardList
            cards={cards}
            selectedId={focusId}
            onSelect={setFocusId}
          />
          <p className="mt-2 text-xs text-zinc-500">
            Selection is visual only in MVP; the engine still evaluates your full
            active wallet.
          </p>
        </div>

        {err && (
          <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </pre>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Computing…" : "Get recommendation"}
        </button>
      </form>

      {result && (
        <RecommendationCard
          amount={result.amount}
          resolvedCategory={result.resolvedCategory}
          bestCard={result.bestCard}
          reasoning={result.reasoning}
          ranked={result.ranked}
          alternatesTied={result.alternatesTied}
          trace={result.categoryResolution.trace}
        />
      )}
    </div>
  );
}
