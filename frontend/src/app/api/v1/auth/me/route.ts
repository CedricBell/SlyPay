import { NextResponse } from "next/server";
import { z } from "zod";
import { walletCardInclude } from "@/lib/credit-card-rules";
import { prisma } from "@/lib/prisma";
import { getSessionAppUser } from "@/lib/session-user";
import { computeWalletOptimizationScore } from "@/lib/wallet-optimization-score";

const patchBody = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
});

export async function GET() {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.appUser.id },
  });

  const cards = await prisma.creditCard.findMany({
    where: { userId: ctx.appUser.id },
    include: walletCardInclude,
  });

  const optimization = computeWalletOptimizationScore(cards);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    optimization,
  });
}

export async function PATCH(req: Request) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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

  const data: { firstName?: string | null; lastName?: string | null } = {};
  if (body.firstName !== undefined) {
    data.firstName = body.firstName.trim() || null;
  }
  if (body.lastName !== undefined) {
    data.lastName = body.lastName.trim() || null;
  }

  const user = await prisma.user.update({
    where: { id: ctx.appUser.id },
    data,
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  });
}
