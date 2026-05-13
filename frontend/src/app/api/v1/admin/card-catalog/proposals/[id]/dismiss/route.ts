import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { dismissCatalogExtractProposal } from "@/server/card-intelligence/apply-catalog-proposal";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    await dismissCatalogExtractProposal(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}
