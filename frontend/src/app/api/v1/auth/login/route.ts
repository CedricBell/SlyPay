import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClientFromRequest } from "@/lib/supabase/route-handler";
import {
  clearSessionTrackingCookies,
  stampFreshSessionCookies,
} from "@/lib/session-timeout";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof loginBody>;
  try {
    body = loginBody.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      {
        message: e instanceof z.ZodError ? e.message : "Invalid request body",
      },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  clearSessionTrackingCookies(response);

  const supabase = createClientFromRequest(request, response);

  const { error } = await supabase.auth.signInWithPassword({
    email: body.email.trim(),
    password: body.password,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        message:
          "Sign-in succeeded but the session could not be stored. Check Supabase URL/keys in .env.",
        code: "no_server_session",
      },
      { status: 401 },
    );
  }

  stampFreshSessionCookies(response);
  return response;
}
