import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** Issuers learned from successful PDF intel (admin reference). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const rows = await prisma.knownIssuer.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 300,
  });

  return NextResponse.json(
    rows.map((r) => ({
      apexDomain: r.apexDomain,
      displayName: r.displayName,
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
    })),
  );
}
