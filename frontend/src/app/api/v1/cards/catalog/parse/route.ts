import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";
import { assessCatalogQuery } from "@/server/catalog-intel-eligibility";
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
      trustedIssuer: false,
      hasOfficialSite: false,
      officialHosts: [] as string[],
    });
  }

  const assessment = assessCatalogQuery(q);
  if (!assessment.issuer || !assessment.name) {
    return NextResponse.json({
      query: q,
      issuer: null,
      name: null,
      trustedIssuer: false,
      hasOfficialSite: false,
      officialHosts: [] as string[],
    });
  }

  const hosts = await resolveIssuerOfficialHostsWithDb(assessment.issuer);

  return NextResponse.json({
    query: q,
    issuer: assessment.issuer,
    name: assessment.name,
    trustedIssuer: assessment.trustedIssuer,
    hasOfficialSite: hosts.length > 0,
    officialHosts: hosts,
  });
}
