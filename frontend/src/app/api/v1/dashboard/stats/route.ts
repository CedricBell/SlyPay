import { NextRequest, NextResponse } from "next/server";
import { getSessionAppUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const ctx = await getSessionAppUser();
  if (!ctx) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const daysRaw = req.nextUrl.searchParams.get("days");
  const days = Math.min(
    Math.max(Number(daysRaw ?? "30") || 30, 1),
    365,
  );

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - days);

  const userId = ctx.appUser.id;

  const [txs, recs, cardCount, activeCardCount] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, createdAt: { gte: since } },
      include: { merchant: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.recommendation.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { resolvedCategory: true, amount: true, createdAt: true },
    }),
    prisma.creditCard.count({ where: { userId } }),
    prisma.creditCard.count({ where: { userId, isActive: true } }),
  ]);

  let totalSpend = 0;
  const byCategory = new Map<string, { amount: number; count: number }>();
  const merchantSpend = new Map<
    string,
    { label: string; amount: number; count: number }
  >();
  const byDay = new Map<string, number>();

  let largestPurchase = { amount: 0 as number, at: null as string | null };

  for (const t of txs) {
    const amt = dec(t.amount);
    totalSpend += amt;

    const catKey = t.category ?? "UNCATEGORIZED";
    const curCat = byCategory.get(catKey) ?? { amount: 0, count: 0 };
    curCat.amount += amt;
    curCat.count += 1;
    byCategory.set(catKey, curCat);

    const label =
      t.merchant?.displayName ??
      (t.note?.trim() ? t.note.trim() : null) ??
      "Unknown merchant";
    const mKey = t.merchantId ?? `anon:${label}`;
    const curM = merchantSpend.get(mKey) ?? { label, amount: 0, count: 0 };
    curM.amount += amt;
    curM.count += 1;
    merchantSpend.set(mKey, curM);

    const day = t.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + amt);

    if (amt > largestPurchase.amount) {
      largestPurchase = { amount: amt, at: t.createdAt.toISOString() };
    }
  }

  const recByCategory = new Map<string, number>();
  let recAmountSum = 0;
  for (const r of recs) {
    recByCategory.set(
      r.resolvedCategory,
      (recByCategory.get(r.resolvedCategory) ?? 0) + 1,
    );
    recAmountSum += dec(r.amount);
  }

  const spendByCategory = [...byCategory.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.amount - a.amount);

  const topMerchants = [...merchantSpend.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const spendByDay = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));

  const recommendationsByCategory = [...recByCategory.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const avgTicket =
    txs.length > 0 ? Math.round((totalSpend / txs.length) * 100) / 100 : 0;

  return NextResponse.json({
    periodDays: days,
    since: since.toISOString(),
    wallet: { cards: cardCount, activeCards: activeCardCount },
    transactions: {
      count: txs.length,
      totalSpend,
      avgTicket,
      largestPurchase:
        txs.length > 0
          ? largestPurchase
          : { amount: 0, at: null as string | null },
    },
    spendByCategory,
    topMerchants,
    spendByDay,
    recommendations: {
      count: recs.length,
      totalAmountConsidered: recAmountSum,
      byCategory: recommendationsByCategory,
    },
  });
}
