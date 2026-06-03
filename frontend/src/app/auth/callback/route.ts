import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stampFreshSessionCookies } from "@/lib/session-timeout";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      stampFreshSessionCookies(response);
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
