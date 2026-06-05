import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/route-handler";
import {
  evaluateSessionExpiry,
  SESSION_COOKIE_LAST_ACTIVE,
  SESSION_COOKIE_STARTED,
  stampFreshSessionCookies,
  touchSessionActivityCookie,
} from "@/lib/session-timeout";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabase = createClientFromRequest(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        message:
          "The server could not read your sign-in session. Refresh the page and try again.",
        code: "no_server_session",
      },
      { status: 401 },
    );
  }

  const started = request.cookies.get(SESSION_COOKIE_STARTED)?.value;
  const lastActive = request.cookies.get(SESSION_COOKIE_LAST_ACTIVE)?.value;

  if (!started || !lastActive) {
    stampFreshSessionCookies(response);
    return response;
  }

  const { expired, reason } = evaluateSessionExpiry(started, lastActive);

  if (expired) {
    stampFreshSessionCookies(response);
    return response;
  }

  touchSessionActivityCookie(response);
  return response;
}
