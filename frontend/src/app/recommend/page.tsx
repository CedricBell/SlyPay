"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MerchantInput } from "@/components/MerchantInput";
import { RecommendationCard } from "@/components/RecommendationCard";
import { WalletCardList } from "@/components/WalletCardList";
import { apiFetch, ApiError } from "@/lib/api";

const LS_AMOUNT = "slypay_last_recommend_amount";

type CardRow = {
  id: string;
  name: string;
  issuer: string;
  last4: string | null;
  colorHex: string | null;
  isActive: boolean;
};

type RecRes = {
  recommendationId: string | null;
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
  marketBest: {
    cardId: string;
    cardName: string;
    issuer: string;
    comparableValue: number;
    effectiveMultiplier: number;
    earningType: string;
    deltaVsWalletBest: number;
  } | null;
};

type NearbyMatch = {
  detectedName: string;
  distanceMeters: number;
  merchant: {
    id: string;
    displayName: string;
    mcc: string | null;
  };
  confidence: number;
};

type NearbyResponse = {
  nearby: Array<{ name: string; distanceMeters: number }>;
  matches: NearbyMatch[];
};

type ConfidenceTier = "high" | "medium" | "low";

function confidenceTier(m: NearbyMatch): ConfidenceTier {
  if (m.confidence >= 100 && m.distanceMeters <= 220) return "high";
  if (m.confidence >= 55 || m.distanceMeters <= 110) return "medium";
  return "low";
}

function tierBadgeClass(t: ConfidenceTier) {
  switch (t) {
    case "high":
      return "border-emerald-400/60 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
    case "medium":
      return "border-amber-400/50 bg-amber-500/15 text-amber-950 dark:text-amber-100";
    default:
      return "border-zinc-400/40 bg-zinc-500/10 text-zinc-800 dark:text-zinc-200";
  }
}

function tierLabel(t: ConfidenceTier) {
  switch (t) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    default:
      return "Low confidence";
  }
}

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
  const [nearby, setNearby] = useState<NearbyMatch[]>([]);
  const [skippedMerchantIds, setSkippedMerchantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeTier, setActiveTier] = useState<ConfidenceTier | null>(null);
  const [oneTapBanner, setOneTapBanner] = useState<string | null>(null);
  const [topDetectedName, setTopDetectedName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_AMOUNT);
      if (v && Number(v) > 0) setAmount(String(v));
    } catch {
      /* ignore */
    }
  }, []);

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

  const visibleMatches = useMemo(
    () => nearby.filter((n) => !skippedMerchantIds.has(n.merchant.id)),
    [nearby, skippedMerchantIds],
  );

  const runRecommendation = useCallback(
    async (override?: {
      merchantName?: string;
      mcc?: string | null;
      amountUsd?: number;
      /** When false, do not clear the one-tap banner before run (used for auto-run). */
      clearBanner?: boolean;
    }) => {
      setErr(null);
      setLoading(true);
      setResult(null);
      if (override?.clearBanner !== false) setOneTapBanner(null);
      const amt = override?.amountUsd ?? Number(amount);
      const name = (override?.merchantName ?? merchant).trim();
      const mccRaw = override?.mcc !== undefined ? override.mcc ?? "" : mcc;
      try {
        const payload: Record<string, unknown> = {
          amount: amt,
          merchantName: name || undefined,
          mcc: String(mccRaw).replace(/\D/g, "").slice(0, 4) || undefined,
          persist: true,
        };
        const res = await apiFetch<RecRes>("/recommendation", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setResult(res);
        try {
          localStorage.setItem(LS_AMOUNT, String(amt));
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (e instanceof ApiError) {
          setErr(e.body || e.message);
        } else setErr("Request failed");
      } finally {
        setLoading(false);
      }
    },
    [amount, merchant, mcc],
  );

  const applyMatch = (m: NearbyMatch) => {
    setMerchant(m.merchant.displayName);
    if (m.merchant.mcc) setMcc(m.merchant.mcc);
    setActiveTier(confidenceTier(m));
    setTopDetectedName(m.detectedName);
  };

  const logWrongMerchantNearby = async (ctx: {
    merchantId: string;
    displayName: string;
    detectedName: string | null;
  }) => {
    try {
      await apiFetch("/recommendations/feedback", {
        method: "POST",
        body: JSON.stringify({
          kind: "WRONG_MERCHANT",
          context: {
            source: "nearby_not_this_merchant",
            merchantId: ctx.merchantId,
            displayName: ctx.displayName,
            detectedName: ctx.detectedName,
          },
        }),
      });
    } catch {
      /* non-blocking */
    }
  };

  const detectNearby = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoMsg("Geolocation not supported on this device.");
      return;
    }
    setGeoLoading(true);
    setGeoMsg(null);
    setSkippedMerchantIds(new Set());
    setOneTapBanner(null);
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
      if (data.matches.length === 0) {
        setActiveTier(null);
        setTopDetectedName(null);
        setGeoMsg(
          "No nearby known merchant detected. You can still type manually.",
        );
        return;
      }
      const top = data.matches[0];
      applyMatch(top);
      const tier = confidenceTier(top);
      setGeoMsg(
        `Detected nearby: ${top.merchant.displayName} (${top.distanceMeters}m).`,
      );
      if (tier === "high") {
        setOneTapBanner(
          `Recommended now for ${top.merchant.displayName} — adjust amount or store if needed.`,
        );
        await runRecommendation({
          merchantName: top.merchant.displayName,
          mcc: top.merchant.mcc,
          amountUsd: Number(amount),
          clearBanner: false,
        });
      } else if (tier === "medium") {
        setOneTapBanner(
          `We prefilled ${top.merchant.displayName}. Tap “Get recommendation” to confirm.`,
        );
      } else {
        setOneTapBanner(
          "Low confidence match — pick an alternative below or type the store name.",
        );
      }
    } catch {
      setGeoMsg("Location access denied or unavailable.");
    } finally {
      setGeoLoading(false);
    }
  };

  const notThisMerchant = async () => {
    const top = visibleMatches[0];
    if (!top) {
      setMerchant("");
      setMcc("");
      setActiveTier(null);
      setTopDetectedName(null);
      return;
    }
    void logWrongMerchantNearby({
      merchantId: top.merchant.id,
      displayName: top.merchant.displayName,
      detectedName: topDetectedName,
    });
    const next = new Set(skippedMerchantIds);
    next.add(top.merchant.id);
    setSkippedMerchantIds(next);
    const rest = nearby.filter((n) => !next.has(n.merchant.id));
    if (rest[0]) {
      applyMatch(rest[0]);
      setGeoMsg(`Switched to ${rest[0].merchant.displayName} (${rest[0].distanceMeters}m).`);
      setOneTapBanner(null);
    } else {
      setMerchant("");
      setMcc("");
      setActiveTier(null);
      setTopDetectedName(null);
      setGeoMsg("No other known matches nearby. Type the merchant manually.");
      setOneTapBanner(null);
    }
  };

  const alternativeMatches = visibleMatches.slice(1, 4);

  return (
    <div className="motion-enter space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          In the moment
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Recommendation
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Nearby mode can prefill the store, score match confidence, and run a
          one-tap recommendation when we are sure. You can always correct the
          merchant or report a mismatch.
        </p>
      </div>

      {oneTapBanner && (
        <div className="rounded-2xl border border-emerald-300/50 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 px-4 py-3 text-sm font-medium text-emerald-950 shadow-sm dark:border-emerald-800/40 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/20 dark:text-emerald-50">
          {oneTapBanner}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runRecommendation();
        }}
        className="space-y-6"
      >
        <div className="rounded-3xl border border-sky-200/60 bg-gradient-to-br from-sky-50/90 to-white/80 p-4 shadow-sm backdrop-blur-md dark:border-sky-900/50 dark:from-sky-950/40 dark:to-zinc-950/40 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Nearby mode (phone)
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Uses your location once per tap to match OpenStreetMap places
                with merchants in SlyPay.
              </p>
              {activeTier && visibleMatches[0] && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tierBadgeClass(activeTier)}`}
                  >
                    {tierLabel(activeTier)}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    score {visibleMatches[0].confidence} ·{" "}
                    {visibleMatches[0].distanceMeters}m
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void detectNearby()}
              disabled={geoLoading}
              className="shrink-0 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {geoLoading ? "Detecting…" : "Use my location"}
            </button>
          </div>
          {geoMsg && (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
              {geoMsg}
            </p>
          )}
          {visibleMatches.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {visibleMatches.slice(0, 4).map((n) => (
                <button
                  key={`${n.merchant.id}-${n.detectedName}`}
                  type="button"
                  className="rounded-full border border-sky-300/60 bg-white/80 px-3 py-1.5 text-xs font-semibold text-sky-900 shadow-sm transition hover:bg-sky-50 active:scale-[0.98] dark:border-sky-800 dark:bg-zinc-950/60 dark:text-sky-100 dark:hover:bg-sky-950/50"
                  onClick={() => {
                    applyMatch(n);
                    setOneTapBanner(null);
                  }}
                >
                  {n.merchant.displayName} ({n.distanceMeters}m)
                </button>
              ))}
              <button
                type="button"
                onClick={() => void notThisMerchant()}
                className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-200 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Not this merchant
              </button>
            </div>
          )}
          {(activeTier === "low" || activeTier === "medium") &&
            alternativeMatches.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Alternatives
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {alternativeMatches.map((n) => (
                    <button
                      key={`alt-${n.merchant.id}-${n.detectedName}`}
                      type="button"
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      onClick={() => {
                        applyMatch(n);
                        setOneTapBanner(
                          `Selected ${n.merchant.displayName}. Tap “Get recommendation”.`,
                        );
                      }}
                    >
                      {n.merchant.displayName} · {n.confidence} pts
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>

        <div className="rounded-3xl border border-zinc-200/70 bg-[var(--surface)] p-4 shadow-sm backdrop-blur-md dark:border-zinc-800/80 sm:p-5">
          <MerchantInput
            value={merchant}
            onChange={setMerchant}
            onPick={(m) => {
              if (m.mcc) setMcc(m.mcc);
              setActiveTier(null);
              setOneTapBanner(null);
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Amount (USD)
            </label>
            <input
              className="w-full rounded-2xl border border-zinc-200/80 bg-white/90 px-4 py-3 text-zinc-900 shadow-inner outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
              className="w-full rounded-2xl border border-zinc-200/80 bg-white/90 px-4 py-3 text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="e.g. 5411"
              value={mcc}
              onChange={(e) => setMcc(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200/70 bg-[var(--surface)] p-4 backdrop-blur-md dark:border-zinc-800/80 sm:p-5">
          <p className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Highlight a card (optional)
          </p>
          <WalletCardList
            cards={cards}
            selectedId={focusId}
            onSelect={setFocusId}
          />
          <p className="mt-3 text-xs text-zinc-500">
            Selection is visual only in MVP; the engine still evaluates your full
            active wallet.
          </p>
        </div>

        {err && (
          <pre className="overflow-x-auto rounded-2xl border border-red-200/80 bg-red-50/90 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
            {err}
          </pre>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 sm:w-auto sm:px-10"
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
          marketBest={result.marketBest}
          recommendationId={result.recommendationId}
          merchantLabel={merchant.trim() || null}
        />
      )}
    </div>
  );
}
