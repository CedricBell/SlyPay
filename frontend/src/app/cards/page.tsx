"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { WalletStack } from "@/components/wallet-stack";
import { useAppData } from "@/lib/app-data";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function CardsPage() {
  const router = useRouter();
  const { me, meReady, cards, cardsReady, refreshCards } = useAppData();

  useEffect(() => {
    if (!meReady) return;
    if (!me) router.replace("/login");
  }, [me, meReady, router]);

  const needsPoll = cards?.some((c) => c.walletScoreAnalyzing) ?? false;

  useEffect(() => {
    if (!needsPoll) return;
    const timer = setInterval(() => {
      void refreshCards(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [needsPoll, refreshCards]);

  if (meReady && !me) return null;

  const loading = !cardsReady && cards === null;

  return (
    <FadeIn className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow="Wallet"
          title="My cards"
          description="Hover a card to preview rewards — your wallet on the left, details on the right."
        />
        {cards && cards.length > 0 && (
          <Button variant="gradient" className="gap-1.5" asChild>
            <Link href="/cards/new">
              <Plus className="size-4" />
              Add card
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr] lg:gap-8">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="hidden h-10 w-full rounded-lg lg:block" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="hidden h-72 w-full rounded-[1.35rem] lg:block" />
        </div>
      ) : (
        <WalletStack cards={cards ?? []} />
      )}
    </FadeIn>
  );
}
