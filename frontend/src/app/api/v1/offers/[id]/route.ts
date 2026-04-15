import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const offer = await prisma.offer.findFirst({
    where: { id },
    include: { creditCard: true },
  });
  if (!offer) {
    return NextResponse.json({ message: "Offer not found" }, { status: 404 });
  }
  if (offer.creditCard.userId !== ctx.appUser.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  await prisma.offer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
