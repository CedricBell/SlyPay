import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAppUser } from "@/lib/session-user";

const bodySchema = z.object({
  body: z.string().min(8).max(4000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const card = await prisma.creditCard.findFirst({
    where: { id, userId: ctx.appUser.id },
    select: { id: true },
  });
  if (!card) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof z.ZodError ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  const row = await prisma.cardWalletContribution.create({
    data: {
      creditCardId: card.id,
      userId: ctx.appUser.id,
      body: body.body.trim(),
    },
  });

  return NextResponse.json({ id: row.id, status: row.status });
}
