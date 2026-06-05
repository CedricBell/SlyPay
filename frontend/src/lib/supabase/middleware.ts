import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieToSet } from "@/lib/supabase/cookie-types";
import {
  clearSessionTrackingCookies,
  evaluateSessionExpiry,
  SESSION_COOKIE_LAST_ACTIVE,
  SESSION_COOKIE_STARTED,
  stampFreshSessionCookies,
  touchSessionActivityCookie,
} from "@/lib/session-timeout";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthApi =
    path.startsWith("/api/v1/auth/session-") ||
    path === "/api/v1/auth/logout" ||
    path === "/api/v1/auth/login";

  if (user && !PUBLIC_PATHS.has(path) && !path.startsWith("/auth/")) {
    const started = request.cookies.get(SESSION_COOKIE_STARTED)?.value;
    const lastActive = request.cookies.get(SESSION_COOKIE_LAST_ACTIVE)?.value;

    if (!started || !lastActive) {
      stampFreshSessionCookies(supabaseResponse);
    } else {
      const { expired, reason } = evaluateSessionExpiry(started, lastActive);

      if (expired) {
        // Fresh Supabase session + stale app timeout cookies (common right after login).
        if (path === "/api/v1/auth/session-touch") {
          stampFreshSessionCookies(supabaseResponse);
        } else {
          await supabase.auth.signOut();
          clearSessionTrackingCookies(supabaseResponse);

          if (path.startsWith("/api/")) {
            return NextResponse.json(
              { message: "Session expired", reason: reason ?? "max_age" },
              { status: 401 },
            );
          }

          const url = request.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("reason", reason ?? "max_age");
          const redirect = NextResponse.redirect(url);
          clearSessionTrackingCookies(redirect);
          return redirect;
        }
      } else if (!isAuthApi) {
        touchSessionActivityCookie(supabaseResponse);
      }
    }
  }

  if (
    user &&
    (path === "/" || path === "/login" || path === "/register")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
