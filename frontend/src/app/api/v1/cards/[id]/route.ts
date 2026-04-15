import { EarningType, SpendCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { mapCreditCardJson } from "@/lib/map-credit-card";

const cardInclude = { rewardRules: true, offers: true } as const;

const ruleInput = z.object({
  category: z.nativeEnum(SpendCategory),
  multiplier: z.number().min(0).max(1000),
  earningType: z.nativeEnum(EarningType).optional(),
  capAmountMonthly: z.number().min(0).optional(),
  priority: z.number().optional(),
  notes: z.string().optional(),
});

const patchBody = z.object({
  name: z.string().min(2).max(120).optional(),
  issuer: z.string().min(2).max(120).optional(),
  last4: z.string().max(4).optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isActive: z.boolean().optional(),
  rules: z.array(ruleInput).optional(),
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
    include: cardInclude,
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

  const card = await prisma.$transaction(async (tx) => {
    await tx.creditCard.update({
      where: { id },
      data: {
        name: body.name,
        issuer: body.issuer,
        last4: body.last4,
        colorHex: body.colorHex,
        isActive: body.isActive,
      },
    });
    if (body.rules) {
      await tx.rewardRule.deleteMany({ where: { creditCardId: id } });
      if (body.rules.length) {
        await tx.rewardRule.createMany({
          data: body.rules.map((r) => ({
            creditCardId: id,
            category: r.category,
            multiplier: r.multiplier,
            earningType: r.earningType ?? EarningType.POINTS,
            capAmountMonthly: r.capAmountMonthly,
            priority: r.priority ?? 0,
            notes: r.notes,
          })),
        });
      }
    }
    return tx.creditCard.findFirstOrThrow({
      where: { id },
      include: cardInclude,
    });
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
