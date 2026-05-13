import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";
import { searchCardCatalogMerged } from "@/server/card-catalog";

export async function GET(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const parsed = limitRaw ? Number(limitRaw) : 12;
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 12;
  const hits = await searchCardCatalogMerged(q, limit);
  return NextResponse.json(hits);
}
