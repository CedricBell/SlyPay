import type { NextResponse } from "next/server";

export const SESSION_COOKIE_STARTED = "sly-session-started";
export const SESSION_COOKIE_LAST_ACTIVE = "sly-session-last-active";

/** Max signed-in duration from first login (default 12 h). */
export function getSessionMaxAgeMs(): number {
  const hours = Number(process.env.SESSION_MAX_AGE_HOURS ?? "12");
  return Math.max(1, hours) * 60 * 60 * 1000;
}

/** Sign out after inactivity (default 30 min). */
export function getSessionIdleMs(): number {
  const minutes = Number(process.env.SESSION_IDLE_MINUTES ?? "30");
  return Math.max(5, minutes) * 60 * 1000;
}

export function getSessionMaxAgeSeconds(): number {
  return Math.ceil(getSessionMaxAgeMs() / 1000);
}

export type SessionExpiryReason = "idle" | "max_age" | "missing";

export function evaluateSessionExpiry(
  startedRaw: string | undefined,
  lastActiveRaw: string | undefined,
  now = Date.now(),
): { expired: boolean; reason?: SessionExpiryReason } {
  if (!startedRaw || !lastActiveRaw) {
    return { expired: true, reason: "missing" };
  }

  const started = Number(startedRaw);
  const lastActive = Number(lastActiveRaw);
  if (!Number.isFinite(started) || !Number.isFinite(lastActive)) {
    return { expired: true, reason: "missing" };
  }

  if (now - started > getSessionMaxAgeMs()) {
    return { expired: true, reason: "max_age" };
  }
  if (now - lastActive > getSessionIdleMs()) {
    return { expired: true, reason: "idle" };
  }

  return { expired: false };
}

export function sessionTrackingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: getSessionMaxAgeSeconds(),
  };
}

export function stampFreshSessionCookies(
  response: NextResponse,
  now = Date.now(),
): void {
  const ts = String(now);
  const opts = sessionTrackingCookieOptions();
  response.cookies.set(SESSION_COOKIE_STARTED, ts, opts);
  response.cookies.set(SESSION_COOKIE_LAST_ACTIVE, ts, opts);
}

export function touchSessionActivityCookie(
  response: NextResponse,
  now = Date.now(),
): void {
  response.cookies.set(
    SESSION_COOKIE_LAST_ACTIVE,
    String(now),
    sessionTrackingCookieOptions(),
  );
}

export function clearSessionTrackingCookies(response: NextResponse): void {
  for (const name of [SESSION_COOKIE_STARTED, SESSION_COOKIE_LAST_ACTIVE]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

export function sessionExpiryMessage(reason: SessionExpiryReason): string {
  if (reason === "idle") {
    return "You were signed out after a period of inactivity.";
  }
  if (reason === "max_age") {
    return "Your session expired. Please sign in again.";
  }
  return "Please sign in to continue.";
}
