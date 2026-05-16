import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { assertEditorialSupplementUrl } from "@/server/card-intelligence/editorial-intel-allowlist";

const patchBody = z.object({
  editorialSupplementUrls: z.union([
    z.array(z.string().trim().min(12).max(2000)).max(6),
    z.null(),
  ]),
});

type Params = { params: Promise<{ slug: string }> };

export async function PATCH(req: NextRequest, ctx: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { slug } = await ctx.params;
  if (!slug?.trim()) {
    return NextResponse.json({ message: "Missing slug" }, { status: 400 });
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

  const exists = await prisma.cardCatalogProduct.findUnique({
    where: { slug },
    select: { slug: true },
  });
  if (!exists) {
    return NextResponse.json({ message: "Catalog product not found" }, { status: 404 });
  }

  if (body.editorialSupplementUrls === null || body.editorialSupplementUrls.length === 0) {
    await prisma.cardCatalogProduct.update({
      where: { slug },
      data: { editorialSupplementUrls: Prisma.JsonNull },
    });
    return NextResponse.json({ ok: true, editorialSupplementUrls: [] });
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of body.editorialSupplementUrls) {
    try {
      const u = assertEditorialSupplementUrl(raw);
      const key = u.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ message: msg }, { status: 400 });
    }
  }

  await prisma.cardCatalogProduct.update({
    where: { slug },
    data: {
      editorialSupplementUrls: normalized as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, editorialSupplementUrls: normalized });
}