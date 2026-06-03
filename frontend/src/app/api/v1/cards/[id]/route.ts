import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { walletCardInclude } from "@/lib/credit-card-rules";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { mapCreditCardJson } from "@/lib/map-credit-card";

const patchBody = z.object({
  last4: z.string().max(4).optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const card = await prisma.creditCard.findFirst({
    where: { id, userId: ctx.appUser.id },
    include: walletCardInclude,
  });
  if (!card) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(mapCreditCardJson(card));
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.creditCard.findFirst({
    where: { id, userId: ctx.appUser.id },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  let body: z.infer<typeof patchBody>;
  try {
    body = patchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof z.ZodError ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  const card = await prisma.creditCard.update({
    where: { id },
    data: {
      last4: body.last4,
      colorHex: body.colorHex,
      isActive: body.isActive,
    },
    include: walletCardInclude,
  });

  return NextResponse.json(mapCreditCardJson(card));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.creditCard.findFirst({
    where: { id, userId: ctx.appUser.id },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  await prisma.creditCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
