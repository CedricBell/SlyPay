import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  getSessionAppUser,
  type SessionContext,
} from "@/lib/session-user";

export type AuthResult =
  | { ok: true; ctx: SessionContext }
  | { ok: false; response: NextResponse };

export async function requireUser(): Promise<AuthResult> {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, ctx };
}

export async function requireAdmin(): Promise<AuthResult> {
  const r = await requireUser();
  if (!r.ok) return r;
  if (r.ctx.appUser.role !== UserRole.ADMIN) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, ctx: r.ctx };
}
