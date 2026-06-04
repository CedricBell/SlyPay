import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";

const ALLOWED_HOST =
  /(americanexpress\.com|creditcards\.chase\.com|\.chase\.com|citibank\.com|\.citi\.com|wellsfargo\.com|bankofamerica\.com|discover\.com|usbank\.com|capitalone\.com|ecm\.capitalone\.com|apple\.com|biltrewards\.com)/i;

export async function GET(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json({ message: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ message: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !ALLOWED_HOST.test(target.hostname)) {
    return NextResponse.json({ message: "Host not allowed" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SpendLess/1.0; +https://spendless.app)",
        Accept: "image/*,*/*;q=0.8",
        Referer: `${target.origin}/`,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { message: `Upstream ${upstream.status}` },
        { status: 502 },
      );
    }

    const ct = upstream.headers.get("content-type") ?? "image/png";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": ct.split(";")[0]?.trim() ?? "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ message: "Fetch failed" }, { status: 502 });
  }
}
