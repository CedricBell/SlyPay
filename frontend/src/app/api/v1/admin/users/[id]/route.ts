import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const patchBody = z.object({
  isActive: z.boolean().optional(),
  role: z.nativeEnum(UserRole).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const actorId = auth.ctx.appUser.id;

  const { id: userId } = await params;

  let body: z.infer<typeof patchBody>;
  try {
    body = patchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof z.ZodError ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  if (body.role === undefined && body.isActive === undefined) {
    return NextResponse.json(
      { message: "Provide isActive and/or role" },
      { status: 400 },
    );
  }

  if (userId === actorId) {
    if (body.isActive === false) {
      return NextResponse.json(
        { message: "You cannot disable your own account" },
        { status: 400 },
      );
    }
    if (body.role !== undefined && body.role !== target.role) {
      return NextResponse.json(
        { message: "You cannot change your own role here" },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(updated);
}
