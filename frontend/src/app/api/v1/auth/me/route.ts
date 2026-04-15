import { NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";

export async function GET() {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(ctx.appUser);
}
