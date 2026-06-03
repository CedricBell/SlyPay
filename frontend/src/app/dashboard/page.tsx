"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CreditCard, Plus } from "lucide-react";
import { NearbyCheckout } from "@/components/nearby-checkout";
import { apiFetch, ApiError } from "@/lib/api";
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
import { SurfaceCard } from "@/components/ui/surface-card";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [cards, setCards] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ email: string }>("/auth/me");
        setEmail(me.email);
        const wallet = await apiFetch<Array<{ id: string }>>("/cards");
        setCards(wallet.length);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setErr("Could not load dashboard");
      }
    })();
  }, [router]);

  if (err) {
    return <StatusMessage variant="error">{err}</StatusMessage>;
  }

  const hasCards = cards !== null && cards > 0;

  return (
    <FadeIn className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title="Home"
        description={
          email ? (
            <>
              Signed in as{" "}
              <span className="font-medium text-foreground">{email}</span>
            </>
          ) : (
            "Loading…"
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SurfaceCard className="p-5 transition hover:ring-violet-500/25">
          <CardHeader className="p-0">
            <CardDescription>Cards configured</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {cards ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            {cards === 0 ? (
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

      {cards === 0 ? (
        <SurfaceCard className="flex flex-col items-start gap-4 border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
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
          <Button variant="gradient" className="shrink-0 gap-1.5" asChild>
            <Link href="/cards/new">
              <Plus className="size-4" />
              Add a card
            </Link>
          </Button>
        </SurfaceCard>
      ) : null}

      {hasCards ? <NearbyCheckout /> : null}
    </FadeIn>
  );
}
