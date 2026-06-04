"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { apiFetchCached, invalidateApiCache } from "@/lib/api-cache";
import type { WalletCard } from "@/components/wallet-stack";

export type AppMe = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

type AppDataContextValue = {
  me: AppMe | null;
  meReady: boolean;
  cards: WalletCard[] | null;
  cardsReady: boolean;
  refreshMe: (force?: boolean) => Promise<AppMe | null>;
  refreshCards: (force?: boolean) => Promise<WalletCard[] | null>;
  invalidateAll: () => void;
};

const PUBLIC_PAGES = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PAGES.has(pathname);

  const [sessionKey, setSessionKey] = useState(0);
  const [me, setMe] = useState<AppMe | null>(null);
  const [meReady, setMeReady] = useState(false);
  const [cards, setCards] = useState<WalletCard[] | null>(null);
  const [cardsReady, setCardsReady] = useState(false);

  const refreshMe = useCallback(async (force = false) => {
    try {
      const data = await apiFetchCached<AppMe>("/auth/me", {
        ttlMs: 120_000,
        force,
      });
      setMe(data);
      return data;
    } catch {
      setMe(null);
      return null;
    } finally {
      setMeReady(true);
    }
  }, []);

  const refreshCards = useCallback(async (force = false) => {
    try {
      const data = await apiFetchCached<WalletCard[]>("/cards", {
        ttlMs: 20_000,
        force,
      });
      setCards(data);
      return data;
    } catch {
      setCards(null);
      return null;
    } finally {
      setCardsReady(true);
    }
  }, []);

  const invalidateAll = useCallback(() => {
    invalidateApiCache();
    setSessionKey((k) => k + 1);
    setMe(null);
    setCards(null);
    setMeReady(false);
    setCardsReady(false);
  }, []);

  useEffect(() => {
    if (isPublic) {
      setMeReady(true);
      setCardsReady(true);
      return;
    }

    let cancelled = false;
    setMeReady(false);
    setCardsReady(false);

    void (async () => {
      await Promise.allSettled([refreshMe(), refreshCards()]);
      if (!cancelled) {
        setMeReady(true);
        setCardsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPublic, sessionKey, refreshMe, refreshCards]);

  const value = useMemo(
    () => ({
      me,
      meReady,
      cards,
      cardsReady,
      refreshMe,
      refreshCards,
      invalidateAll,
    }),
    [me, meReady, cards, cardsReady, refreshMe, refreshCards, invalidateAll],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}

export function useAppDataOptional() {
  return useContext(AppDataContext);
}

export function invalidateAppDataCache() {
  invalidateApiCache();
}
