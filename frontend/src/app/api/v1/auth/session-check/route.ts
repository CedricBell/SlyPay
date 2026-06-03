import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateSessionExpiry,
  getSessionIdleMs,
  getSessionMaxAgeMs,
  SESSION_COOKIE_LAST_ACTIVE,
  SESSION_COOKIE_STARTED,
} from "@/lib/session-timeout";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const started = cookieStore.get(SESSION_COOKIE_STARTED)?.value;
  const lastActive = cookieStore.get(SESSION_COOKIE_LAST_ACTIVE)?.value;

  if (!started || !lastActive) {
    const response = NextResponse.json({
      ok: true,
      maxRemainingMs: getSessionMaxAgeMs(),
      idleRemainingMs: getSessionIdleMs(),
      idleMs: getSessionIdleMs(),
      maxAgeMs: getSessionMaxAgeMs(),
    });
    return response;
  }

  const now = Date.now();
  const { expired, reason } = evaluateSessionExpiry(started, lastActive, now);

  if (expired) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { message: "Session expired", reason: reason ?? "max_age" },
      { status: 401 },
    );
  }

  const startedMs = Number(started);
  const lastActiveMs = Number(lastActive);

  return NextResponse.json({
    ok: true,
    maxRemainingMs: Math.max(0, startedMs + getSessionMaxAgeMs() - now),
    idleRemainingMs: Math.max(0, lastActiveMs + getSessionIdleMs() - now),
    idleMs: getSessionIdleMs(),
    maxAgeMs: getSessionMaxAgeMs(),
  });
}
