import { OfferStackPolicy, SpendCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";

const createBody = z.object({
  creditCardId: z.string(),
  title: z.string().min(2),
  category: z.nativeEnum(SpendCategory).optional(),
  multiplier: z.number().min(0).max(1000),
  stackPolicy: z.nativeEnum(OfferStackPolicy).optional(),
  validFrom: z.string(),
  validUntil: z.string(),
});

function mapOffer<
  T extends { multiplier: unknown; creditCard?: unknown },
>(o: T) {
  return {
    ...o,
    multiplier: dec(o.multiplier),
  };
}

export async function GET(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const cardId = req.nextUrl.searchParams.get("cardId") ?? undefined;
  const rows = await prisma.offer.findMany({
    where: {
      creditCard: { userId: ctx.appUser.id },
      ...(cardId ? { creditCardId: cardId } : {}),
    },
    orderBy: { validFrom: "desc" },
    include: {
      creditCard: { select: { id: true, name: true, issuer: true } },
    },
  });
  return NextResponse.json(rows.map((r) => mapOffer(r)));
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

  const card = await prisma.creditCard.findFirst({
    where: { id: body.creditCardId, userId: ctx.appUser.id },
  });
  if (!card) {
    return NextResponse.json(
      { message: "Card not found for this user" },
      { status: 403 },
    );
  }

  const row = await prisma.offer.create({
    data: {
      creditCardId: body.creditCardId,
      title: body.title,
      category: body.category,
      multiplier: body.multiplier,
      stackPolicy: body.stackPolicy ?? OfferStackPolicy.REPLACE_BASE,
      validFrom: new Date(body.validFrom),
      validUntil: new Date(body.validUntil),
    },
    include: { creditCard: { select: { id: true, name: true } } },
  });

  return NextResponse.json(mapOffer(row));
}
