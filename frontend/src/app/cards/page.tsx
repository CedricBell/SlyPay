"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { WalletStack, type WalletCard } from "@/components/wallet-stack";
import { apiFetch, ApiError } from "@/lib/api";
import { intelIsActive } from "@/lib/card-intel-status";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    const c = await apiFetch<WalletCard[]>("/cards");
    setCards(c);
    return c;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadCards();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setErr("Failed to load cards");
      }
    })();
  }, [router, loadCards]);

  const needsPoll = cards.some(
    (c) => c.walletScoreAnalyzing || intelIsActive(c.intelJob),
  );

  useEffect(() => {
    if (!needsPoll) return;
    const timer = setInterval(() => {
      void loadCards().catch(() => {
        /* keep polling */
      });
    }, 2800);
    return () => clearInterval(timer);
  }, [needsPoll, loadCards]);

  return (
    <FadeIn className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow="Wallet"
          title="My cards"
          description="Your cards, rewards, and perks — stacked like a real wallet."
        />
        {cards.length > 0 && (
          <Button variant="gradient" className="gap-1.5" asChild>
            <Link href="/cards/new">
              <Plus className="size-4" />
              Add card
            </Link>
          </Button>
        )}
      </div>

      {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}

      <WalletStack cards={cards} />
    </FadeIn>
  );
}
