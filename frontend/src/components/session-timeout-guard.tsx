"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { sessionExpiryMessage } from "@/lib/session-timeout";

/** Pages accessibles sans session — no session polling / forced logout. */
const PUBLIC_PAGES = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

const CHECK_INTERVAL_MS = 60_000;
const TOUCH_DEBOUNCE_MS = 120_000;

export function SessionTimeoutGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const lastTouchRef = useRef(0);
  const signingOutRef = useRef(false);

  const forceLogout = useCallback(
    async (reason: "idle" | "max_age" | "missing" = "max_age") => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      try {
        await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
      } catch {
        /* best effort */
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.info(sessionExpiryMessage(reason));
      router.replace(`/login?reason=${reason}`);
      router.refresh();
    },
    [router],
  );

  const touchSession = useCallback(async () => {
    const now = Date.now();
    if (now - lastTouchRef.current < TOUCH_DEBOUNCE_MS) return;
    lastTouchRef.current = now;
    try {
      const res = await fetch("/api/v1/auth/session-touch", {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 401) {
        const body = (await res.json().catch(() => ({}))) as { reason?: string };
        if (body.reason === "idle" || body.reason === "max_age" || body.reason === "missing") {
          await forceLogout(body.reason);
        }
      }
    } catch {
      /* offline — next check will retry */
    }
  }, [forceLogout]);

  const checkSession = useCallback(async () => {
    if (PUBLIC_PAGES.has(pathname)) return;
    try {
      const res = await fetch("/api/v1/auth/session-check", {
        credentials: "include",
      });
      if (res.status === 401) {
        const body = (await res.json().catch(() => ({}))) as { reason?: string };
        if (body.reason === "idle" || body.reason === "max_age" || body.reason === "missing") {
          await forceLogout(body.reason);
        }
      }
    } catch {
      /* ignore transient errors */
    }
  }, [forceLogout, pathname]);

  useEffect(() => {
    if (PUBLIC_PAGES.has(pathname)) return;

    const onActivity = () => {
      void touchSession();
    };

    const events: (keyof WindowEventMap)[] = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ];

    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    void checkSession();
    const timer = window.setInterval(() => {
      void checkSession();
    }, CHECK_INTERVAL_MS);

    return () => {
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
      window.clearInterval(timer);
    };
  }, [checkSession, pathname, touchSession]);

  return null;
}
