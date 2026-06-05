import { NextRequest, NextResponse } from "next/server";
import { CardWalletContributionStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  status: z.enum(["APPLIED", "DISMISSED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof z.ZodError ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  const existing = await prisma.cardWalletContribution.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const row = await prisma.cardWalletContribution.update({
    where: { id },
    data: {
      status: body.status as CardWalletContributionStatus,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({
    id: row.id,
    status: row.status,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  });
}
