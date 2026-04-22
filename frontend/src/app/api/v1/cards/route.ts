import { EarningType, SpendCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { mapCreditCardJson } from "@/lib/map-credit-card";

const cardInclude = {
  rewardRules: true,
  offers: true,
} as const;

const ruleInput = z.object({
  category: z.nativeEnum(SpendCategory),
  multiplier: z.number().min(0).max(1000),
  earningType: z.nativeEnum(EarningType).optional(),
  capAmountMonthly: z.number().min(0).optional(),
  priority: z.number().optional(),
  notes: z.string().optional(),
});

const createBody = z.object({
  name: z.string().min(2).max(120),
  issuer: z.string().min(2).max(120),
  last4: z.string().max(4).optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isActive: z.boolean().optional(),
  rules: z.array(ruleInput).optional(),
});

function sanitizeRules(
  rules: z.infer<typeof ruleInput>[] | undefined,
): z.infer<typeof ruleInput>[] {
  if (!rules?.length) return [];
  const byCategory = new Map<SpendCategory, z.infer<typeof ruleInput>>();
  for (const rule of rules) {
    const current = byCategory.get(rule.category);
    if (!current || rule.multiplier > current.multiplier) {
      byCategory.set(rule.category, rule);
    }
  }
  if (!byCategory.has(SpendCategory.OTHER)) {
    byCategory.set(SpendCategory.OTHER, {
      category: SpendCategory.OTHER,
      multiplier: 1,
      earningType: EarningType.POINTS,
      priority: -1,
      notes: "Auto-added fallback rule",
    });
  }
  return [...byCategory.values()];
}

export async function GET() {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.creditCard.findMany({
    where: { userId: ctx.appUser.id },
    orderBy: { createdAt: "desc" },
    include: cardInclude,
  });
  return NextResponse.json(rows.map((c) => mapCreditCardJson(c)));
}

export async function POST(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof createBody>;
  try {
    body = createBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof z.ZodError ? e.message : "Invalid body" },
      { status: 400 },
    );
  }
  const normalizedRules = sanitizeRules(body.rules);

  const card = await prisma.$transaction(async (tx) => {
    const c = await tx.creditCard.create({
      data: {
        userId: ctx.appUser.id,
        name: body.name,
        issuer: body.issuer,
        last4: body.last4,
        colorHex: body.colorHex,
        isActive: body.isActive ?? true,
      },
      include: cardInclude,
    });
    if (normalizedRules.length) {
      await tx.rewardRule.createMany({
        data: normalizedRules.map((r) => ({
          creditCardId: c.id,
          category: r.category,
          multiplier: r.multiplier,
          earningType: r.earningType ?? EarningType.POINTS,
          capAmountMonthly: r.capAmountMonthly,
          priority: r.priority ?? 0,
          notes: r.notes,
        })),
      });
    }
    return tx.creditCard.findFirstOrThrow({
      where: { id: c.id },
      include: cardInclude,
    });
  });

  return NextResponse.json(mapCreditCardJson(card));
}
