"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CreditCard, Plus } from "lucide-react";
import { NearbyCheckout } from "@/components/nearby-checkout";
import { ApiError } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BorderBeam } from "@/components/ui/border-beam";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const router = useRouter();
  const { me, meReady, cards, cardsReady } = useAppData();

  useEffect(() => {
    if (!meReady) return;
    if (!me) router.replace("/login");
  }, [me, meReady, router]);

  if (meReady && !me) {
    return null;
  }

  const cardCount = cards?.length ?? null;
  const hasCards = cardCount !== null && cardCount > 0;
  const loading = !meReady || !cardsReady;

  return (
    <FadeIn className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title="Home"
        description={
          me ? (
            <>
              Signed in as{" "}
              <span className="font-medium text-foreground">{me.email}</span>
            </>
          ) : loading ? (
            <span
              className="inline-block h-4 w-48 animate-pulse rounded-md bg-muted align-middle"
              aria-hidden
            />
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SurfaceCard disableMotion className="p-5">
          <CardHeader className="p-0">
            <CardDescription>Cards configured</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {loading ? (
                <Skeleton className="inline-block h-9 w-12" />
              ) : (
                cardCount
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            {!loading && cardCount === 0 ? (
              <Button variant="gradient" size="sm" className="gap-1.5" asChild>
                <Link href="/cards/new">
                  <Plus className="size-4" />
                  Add your first card
                </Link>
              </Button>
            ) : hasCards ? (
              <Button variant="link" className="h-auto p-0" asChild>
                <Link href="/cards">My cards →</Link>
              </Button>
            ) : null}
          </CardContent>
        </SurfaceCard>

        <Card className="rounded-3xl border-border/80 bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-transparent p-5 shadow-md backdrop-blur-xl">
          <CardHeader className="p-0">
            <CardDescription>Fast recommendation</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-5 text-primary" />
              Best card, right now
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <CardDescription className="text-sm leading-snug">
              Locate a store, get the top card for that purchase — explained in
              plain English.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {!loading && cardCount === 0 ? (
        <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card/90 to-violet-500/5 p-5 shadow-md backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <BorderBeam
            duration={12}
            colorFrom="#f59e0b"
            colorTo="#7c3aed"
            borderWidth={1.5}
          />
          <div className="relative flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <CreditCard className="size-5" strokeWidth={2} />
            </span>
            <div>
              <p className="font-semibold text-foreground">
                Add a card to get started
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                SlyPay needs at least one card in your wallet before it can
                recommend which one to use at checkout.
              </p>
            </div>
          </div>
          <Button
            variant="gradient"
            className="relative z-10 shrink-0 gap-1.5"
            asChild
          >
            <Link href="/cards/new">
              <Plus className="size-4" />
              Add a card
            </Link>
          </Button>
        </div>
      ) : null}

      {hasCards ? <NearbyCheckout /> : null}
    </FadeIn>
  );
}
