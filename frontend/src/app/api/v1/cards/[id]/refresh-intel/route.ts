import { after, NextRequest, NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { runCardIntelJob } from "@/server/card-intelligence/run-intel-job";

type Params = { params: Promise<{ id: string }> };

/** Re-queues catalog intelligence for a wallet card linked to a catalog product. */
export async function POST(_req: NextRequest, { params }: Params) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const card = await prisma.creditCard.findFirst({
    where: { id, userId: ctx.appUser.id },
    select: { catalogProductSlug: true },
  });
  if (!card) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (!card.catalogProductSlug) {
    return NextResponse.json(
      { message: "This card is not linked to a catalog product." },
      { status: 400 },
    );
  }

  after(async () => {
    await runCardIntelJob({
      productSlug: card.catalogProductSlug!,
      creditCardId: id,
      forceReanalyze: true,
    });
  });

  return NextResponse.json({ queued: true });
}
