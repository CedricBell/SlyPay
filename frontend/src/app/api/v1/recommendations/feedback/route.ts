import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAppUser } from "@/lib/session-user";

const bodySchema = z.object({
  recommendationId: z.string().min(1).max(64).optional(),
  kind: z.enum([
    "WRONG_MERCHANT",
    "WRONG_CATEGORY",
    "REWARD_MISMATCH",
    "WRONG_CARD_IN_PRACTICE",
    "OTHER",
  ]),
  note: z.string().max(2000).optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let dto: z.infer<typeof bodySchema>;
  try {
    dto = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof z.ZodError ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  if (dto.recommendationId) {
    const rec = await prisma.recommendation.findFirst({
      where: { id: dto.recommendationId, userId: ctx.appUser.id },
      select: { id: true },
    });
    if (!rec) {
      return NextResponse.json({ message: "Recommendation not found" }, { status: 404 });
    }
  }

  const row = await prisma.recommendationFeedback.create({
    data: {
      userId: ctx.appUser.id,
      recommendationId: dto.recommendationId ?? null,
      kind: dto.kind,
      note: dto.note?.trim() || null,
      context: dto.context ?? undefined,
    },
  });

  return NextResponse.json({ id: row.id, ok: true });
}
