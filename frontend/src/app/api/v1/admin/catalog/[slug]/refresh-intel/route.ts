import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { runCardIntelJob } from "@/server/card-intelligence/run-intel-job";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  const trimmed = slug.trim();
  if (!trimmed) {
    return NextResponse.json({ message: "Invalid slug" }, { status: 400 });
  }

  await runCardIntelJob({
    productSlug: trimmed,
    forceReanalyze: true,
  });

  return NextResponse.json({ ok: true, productSlug: trimmed });
}
