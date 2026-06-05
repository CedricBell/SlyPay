"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpendCategory } from "@prisma/client";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";
import {
  confidenceTier,
  displayName,
  placeKey,
  type ConfidenceTier,
  type NearbyMatch,
  type NearbyResponse,
} from "@/lib/nearby-types";
import { type RecRes } from "@/lib/recommendation-types";

const LS_GEO_GRANTED = "slypay_geo_granted";

export function useNearbyCheckout() {
  const [merchant, setMerchant] = useState("");
  const [mcc, setMcc] = useState("");
  const [result, setResult] = useState<RecRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyMatch[]>([]);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [searchLat, setSearchLat] = useState<number | null>(null);
  const [searchLng, setSearchLng] = useState<number | null>(null);
  const [activeTier, setActiveTier] = useState<ConfidenceTier | null>(null);
  const [oneTapBanner, setOneTapBanner] = useState<string | null>(null);
  const [topDetectedName, setTopDetectedName] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [placeCategoryHint, setPlaceCategoryHint] =
    useState<SpendCategory | null>(null);
  const autoGeoRan = useRef(false);
  const detectNearbyRef = useRef<(() => Promise<void>) | null>(null);

  const hasLocation = searchLat !== null && searchLng !== null;

  const knownVisibleMatches = useMemo(
    () => nearby.filter((m) => m.merchant),
    [nearby],
  );

  const onMerchantPick = useCallback((m: { mcc: string | null }) => {
    if (m.mcc) setMcc(m.mcc);
    else setMcc("");
    setActiveTier(null);
    setOneTapBanner(null);
    setPlaceCategoryHint(null);
  }, []);

  const applyMatch = useCallback((m: NearbyMatch) => {
    setSelectedKey(placeKey(m));
    setGeoMsg(`Selected ${displayName(m)}.`);
    if (!m.merchant) {
      setMerchant(m.detectedName);
      setMcc("");
      setPlaceCategoryHint(m.suggestedCategoryHint ?? null);
      setActiveTier("low");
      setTopDetectedName(m.detectedName);
      return;
    }
    setMerchant(m.merchant.displayName);
    if (m.merchant.mcc) setMcc(m.merchant.mcc);
    setPlaceCategoryHint(null);
    setActiveTier(confidenceTier(m));
    setTopDetectedName(m.detectedName);
  }, []);

  const runRecommendation = useCallback(
    async (override?: {
      merchantName?: string;
      mcc?: string | null;
      clearBanner?: boolean;
      categoryHint?: SpendCategory | null;
    }) => {
      setErr(null);
      setLoading(true);
      setResult(null);
      if (override?.clearBanner !== false) setOneTapBanner(null);
      const name = (override?.merchantName ?? merchant).trim();
      const mccRaw = override?.mcc !== undefined ? (override.mcc ?? "") : mcc;
      try {
        const payload: Record<string, unknown> = {
          merchantName: name || undefined,
          mcc: String(mccRaw).replace(/\D/g, "").slice(0, 4) || undefined,
          persist: true,
        };
        const effectiveHint =
          override && "categoryHint" in override
            ? override.categoryHint
            : placeCategoryHint;
        if (effectiveHint) {
          payload.categoryHint = effectiveHint;
        }
        const res = await apiFetch<RecRes>("/recommendation", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setResult(res);
      } catch (e) {
        if (e instanceof ApiError) {
          setErr(formatCaughtApiError(e));
        } else setErr("Request failed");
      } finally {
        setLoading(false);
      }
    },
    [merchant, mcc, placeCategoryHint],
  );

  const searchNearbyAt = useCallback(
    async (
      lat: number,
      lng: number,
      opts?: {
        autoRecommend?: boolean;
        clearBanner?: boolean;
        /** When true (Search this area), do not auto-pick the top match. */
        preserveSelection?: boolean;
      },
    ) => {
      setGeoLoading(true);
      if (opts?.clearBanner !== false) setOneTapBanner(null);
      setSearchLat(lat);
      setSearchLng(lng);
      try {
        const data = await apiFetch<NearbyResponse>(
          `/merchants/nearby?lat=${lat}&lng=${lng}`,
        );
        setNearby(data.matches);
        if (data.matches.length === 0) {
          setActiveTier(null);
          setTopDetectedName(null);
          setSelectedKey(null);
          setGeoMsg("No places in this area.");
          return;
        }
        if (!opts?.preserveSelection) {
          const top = data.matches.filter((m) => m.merchant)[0] ?? data.matches[0];
          applyMatch(top);
          const tier = confidenceTier(top);
          if (opts?.autoRecommend && tier === "high" && top.merchant) {
            setOneTapBanner(
              `Recommended now for ${top.merchant.displayName} — change store if needed.`,
            );
            await runRecommendation({
              merchantName: top.merchant.displayName,
              mcc: top.merchant.mcc,
              clearBanner: false,
              categoryHint: null,
            });
          } else if (opts?.autoRecommend && tier === "medium" && top.merchant) {
            setOneTapBanner(
              `We prefilled ${top.merchant.displayName}. Tap “Get recommendation” to confirm.`,
            );
          } else if (opts?.autoRecommend) {
            setOneTapBanner(
              "Pick the right place on the map or list, or type the store name.",
            );
          }
        }
      } catch {
        setGeoMsg("Could not load nearby places.");
      } finally {
        setGeoLoading(false);
      }
    },
    [applyMatch, runRecommendation],
  );

  const searchThisArea = useCallback(
    async (lat: number, lng: number) => {
      setGeoMsg(null);
      await searchNearbyAt(lat, lng, {
        autoRecommend: false,
        clearBanner: true,
        preserveSelection: true,
      });
    },
    [searchNearbyAt],
  );

  const detectNearby = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoMsg("Geolocation not supported on this device.");
      return;
    }
    setGeoLoading(true);
    setGeoMsg(null);
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
      setGpsLat(lat);
      setGpsLng(lng);
      try {
        sessionStorage.setItem(LS_GEO_GRANTED, "1");
      } catch {
        /* ignore */
      }
      await searchNearbyAt(lat, lng, { autoRecommend: true, clearBanner: false });
    } catch {
      setGeoMsg("Location access denied or unavailable.");
      setGeoLoading(false);
    }
  }, [searchNearbyAt]);

  detectNearbyRef.current = detectNearby;

  useEffect(() => {
    if (autoGeoRan.current) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const runIfGranted = () => {
      if (autoGeoRan.current) return;
      autoGeoRan.current = true;
      void detectNearbyRef.current?.();
    };

    const setup = async () => {
      try {
        if (sessionStorage.getItem(LS_GEO_GRANTED) === "1") {
          runIfGranted();
          return;
        }
      } catch {
        /* private mode */
      }

      try {
        if ("permissions" in navigator) {
          const status = await navigator.permissions.query({
            name: "geolocation",
          });
          if (status.state === "granted") {
            runIfGranted();
            return;
          }
          status.onchange = () => {
            if (status.state === "granted") runIfGranted();
          };
        }
      } catch {
        /* Permissions API unavailable */
      }
    };

    void setup();
  }, []);

  const selectedMatch = useMemo(() => {
    if (selectedKey) {
      return nearby.find((m) => placeKey(m) === selectedKey) ?? null;
    }
    return knownVisibleMatches[0] ?? null;
  }, [selectedKey, nearby, knownVisibleMatches]);

  return {
    merchant,
    setMerchant,
    onMerchantPick,
    result,
    loading,
    err,
    geoLoading,
    geoMsg,
    hasLocation,
    nearby,
    gpsLat,
    gpsLng,
    searchLat,
    searchLng,
    selectedMatch,
    activeTier,
    setActiveTier,
    oneTapBanner,
    setOneTapBanner,
    placeCategoryHint,
    setPlaceCategoryHint,
    selectedKey,
    knownVisibleMatches,
    applyMatch,
    runRecommendation,
    detectNearby,
    searchThisArea,
  };
}
