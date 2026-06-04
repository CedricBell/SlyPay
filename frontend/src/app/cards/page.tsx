"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { WalletStack } from "@/components/wallet-stack";
import { useAppData } from "@/lib/app-data";
import { intelIsActive } from "@/lib/card-intel-status";
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

  const needsPoll =
    cards != null &&
    cards.some((c) => c.walletScoreAnalyzing || intelIsActive(c.intelJob));

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
          description="Your cards, rewards, and perks — stacked like a real wallet."
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
        <div className="mx-auto max-w-lg space-y-4 pt-2">
          <Skeleton className="h-44 w-full rounded-[1.35rem]" />
          <Skeleton className="h-44 w-full rounded-[1.35rem]" />
        </div>
      ) : (
        <WalletStack cards={cards ?? []} />
      )}
    </FadeIn>
  );
}
