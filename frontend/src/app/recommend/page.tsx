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

type NearbyResponse = {
  nearby: Array<{ name: string; distanceMeters: number }>;
  matches: Array<{
    detectedName: string;
    distanceMeters: number;
    merchant: { id: string; displayName: string; mcc: string | null };
    confidence: number;
  }>;
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
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyResponse["matches"]>([]);

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

  const detectNearby = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoMsg("Geolocation not supported on this device.");
      return;
    }
    setGeoLoading(true);
    setGeoMsg(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 120000,
        });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const data = await apiFetch<NearbyResponse>(
        `/merchants/nearby?lat=${lat}&lng=${lng}`,
      );
      setNearby(data.matches);
      if (data.matches.length > 0) {
        const top = data.matches[0];
        setMerchant(top.merchant.displayName);
        if (top.merchant.mcc) setMcc(top.merchant.mcc);
        setGeoMsg(
          `Detected nearby: ${top.merchant.displayName} (${top.distanceMeters}m).`,
        );
      } else {
        setGeoMsg("No nearby known merchant detected. You can still type manually.");
      }
    } catch {
      setGeoMsg("Location access denied or unavailable.");
    } finally {
      setGeoLoading(false);
    }
  };

  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    void (async () => {
      try {
        const p = await navigator.permissions.query({ name: "geolocation" });
        if (p.state === "granted") {
          void detectNearby();
        }
      } catch {
        // ignore unsupported Permissions API
      }
    })();
  }, []);

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
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Nearby mode (phone)
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Detect nearby merchants from your location and prefill recommendation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void detectNearby()}
              disabled={geoLoading}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {geoLoading ? "Detecting…" : "Use my location"}
            </button>
          </div>
          {geoMsg && (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{geoMsg}</p>
          )}
          {nearby.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nearby.slice(0, 4).map((n) => (
                <button
                  key={`${n.merchant.id}-${n.detectedName}`}
                  type="button"
                  className="rounded-full border border-sky-300 px-2.5 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/50"
                  onClick={() => {
                    setMerchant(n.merchant.displayName);
                    if (n.merchant.mcc) setMcc(n.merchant.mcc);
                  }}
                >
                  {n.merchant.displayName} ({n.distanceMeters}m)
                </button>
              ))}
            </div>
          )}
        </div>
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
