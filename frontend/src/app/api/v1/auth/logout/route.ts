import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearSessionTrackingCookies } from "@/lib/session-timeout";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.json({ ok: true });
  clearSessionTrackingCookies(response);
  return response;
}
