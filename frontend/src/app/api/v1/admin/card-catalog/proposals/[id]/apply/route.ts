import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { applyCatalogExtractProposal } from "@/server/card-intelligence/apply-catalog-proposal";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    const result = await applyCatalogExtractProposal(id);
    return NextResponse.json({
      ok: true,
      productSlug: result.productSlug,
      linkedCardsUpdated: result.linkedCardsUpdated,
      rulesPerCard: result.rulesPerCard,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}
