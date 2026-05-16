import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";
import { inferIssuerAndProductName } from "@/server/catalog-infer";
import { resolveIssuerOfficialHostsWithDb } from "@/server/card-intelligence/issuer-official-hosts";

export async function GET(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({
      query: q,
      issuer: null,
      name: null,
      hasOfficialSite: false,
      officialHosts: [] as string[],
    });
  }

  const inferred = inferIssuerAndProductName(q);
  if (!inferred) {
    return NextResponse.json({
      query: q,
      issuer: null,
      name: null,
      hasOfficialSite: false,
      officialHosts: [],
    });
  }

  const hosts = await resolveIssuerOfficialHostsWithDb(inferred.issuer);

  return NextResponse.json({
    query: q,
    issuer: inferred.issuer,
    name: inferred.name,
    hasOfficialSite: hosts.length > 0,
    officialHosts: hosts,
  });
}
