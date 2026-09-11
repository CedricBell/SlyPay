"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Plus, Sparkles } from "lucide-react";
import { CardIntelProgress } from "@/components/card-intel-progress";
import { CardThumbnail } from "@/components/CardThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { walletPerkKey, type MappedIntelJob, type WalletPerkPreview } from "@/lib/map-credit-card";
import type { RotatingQuarterPreview } from "@/lib/rotating-rewards";
import { intelHasFailed } from "@/lib/card-intel-status";
import type { StatementCreditDisplay } from "@/lib/statement-credit-display";
import { cn } from "@/lib/utils";

export type WalletCard = {
  id: string;
  name: string;
  issuer: string;
  last4: string | null;
  colorHex: string | null;
  isActive: boolean;
  catalogLinked: boolean;
  hasOfficialPdfExtract: boolean;
  walletScoreAnalyzing?: boolean;
  intelJob: MappedIntelJob | null;
  walletPreview: {
    ruleHighlights: string[];
    pdfSummary: string | null;
    benefitsSummary: string | null;
    statementCreditHints: string[];
    statementCredits?: StatementCreditDisplay[];
    protectionHints: string[];
    perkHints?: WalletPerkPreview[];
    rotatingQuarters?: RotatingQuarterPreview[];
  };
  catalogImageUrl?: string | null;
};

type Props = {
  cards: WalletCard[];
};

function CardRewardsBody({ card }: { card: WalletCard }) {
  if (card.walletScoreAnalyzing) {
    return (
      <CardIntelProgress
        intelJob={card.intelJob}
        pdfSummary={card.walletPreview.pdfSummary}
        creditHints={card.walletPreview.statementCreditHints}
        ruleHighlights={card.walletPreview.ruleHighlights}
      />
    );
  }

  if (
    intelHasFailed(card.intelJob) &&
    card.walletPreview.ruleHighlights.length === 0
  ) {
    return (
      <CardIntelProgress
        intelJob={card.intelJob}
        pdfSummary={card.walletPreview.pdfSummary}
        creditHints={card.walletPreview.statementCreditHints}
        ruleHighlights={[]}
      />
    );
  }

  if (card.walletPreview.ruleHighlights.length > 0) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Top earn rates
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {card.walletPreview.ruleHighlights.map((line) => (
              <li
                key={line}
                className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground/90"
              >
                {line.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
          {card.walletPreview.benefitsSummary ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {card.walletPreview.benefitsSummary}
            </p>
          ) : null}
        </div>

        {(card.walletPreview.rotatingQuarters?.length ?? 0) > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quarterly 5% categories
            </p>
            <ul className="mt-2 space-y-2">
              {card.walletPreview.rotatingQuarters!.map((q) => (
                <li
                  key={`${q.label}-${q.validFrom}`}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    q.isActive
                      ? "border-orange-300/60 bg-orange-50/80 dark:border-orange-500/30 dark:bg-orange-950/30"
                      : "border-border/60 bg-muted/30",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {q.label}
                    </span>
                    {q.isActive ? (
                      <Badge
                        variant="secondary"
                        className="h-5 bg-orange-200/80 text-[10px] text-orange-950 dark:bg-orange-900/60 dark:text-orange-100"
                      >
                        Active now
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.multiplier}% on{" "}
                    {q.categories.map((c) => c.replaceAll("_", " ").toLowerCase()).join(", ")}
                    {q.details ? ` — ${q.details}` : ""}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Activate each quarter on the issuer site — rewards are not retroactive. Combined
              bonus spend is typically capped at $1,500/quarter.
            </p>
          </div>
        )}

        {(card.walletPreview.statementCredits?.length ??
          card.walletPreview.statementCreditHints.length) > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Statement credits
            </p>
            <ul className="mt-2 space-y-2.5">
              {(card.walletPreview.statementCredits?.length
                ? card.walletPreview.statementCredits
                : card.walletPreview.statementCreditHints.map((hint) => ({
                    title: hint,
                    amountText: null,
                    cadence: null,
                    amountSummary: null,
                    merchantHint: null,
                    enrollmentRequired: false,
                    detail: null,
                  }))
              ).map((c) => (
                <li
                  key={`${c.title}-${c.amountText}-${c.cadence}`}
                  className="text-sm text-amber-900/85 dark:text-amber-100/85"
                >
                  <span className="font-medium text-amber-950 dark:text-amber-50">
                    {c.title}
                  </span>
                  {c.amountSummary ? (
                    <span className="text-amber-800/90 dark:text-amber-200/90">
                      {" "}
                      · {c.amountSummary}
                    </span>
                  ) : null}
                  {c.detail ? (
                    <span className="mt-0.5 block text-xs opacity-90">{c.detail}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {card.walletPreview.protectionHints.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Protections & insurance
            </p>
            <ul className="mt-2 space-y-1.5">
              {card.walletPreview.protectionHints.map((hint) => (
                <li
                  key={hint}
                  className="text-sm text-sky-900/85 dark:text-sky-100/85"
                >
                  {hint}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(card.walletPreview.perkHints?.length ?? 0) > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Travel & hotel programs
            </p>
            <ul className="mt-2 space-y-2">
              {card.walletPreview.perkHints!.map((perk, index) => (
                <li
                  key={walletPerkKey(perk, index)}
                  className="text-sm text-violet-900/85 dark:text-violet-100/85"
                >
                  <span className="font-medium text-violet-950 dark:text-violet-50">
                    {perk.title}
                  </span>
                  {perk.description && perk.description !== perk.title ? (
                    <span className="text-violet-800/90 dark:text-violet-200/90">
                      {" "}
                      — {perk.description}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      No reward rules yet — open this card to configure.
    </p>
  );
}

function CardDetailPanel({
  card,
  reduceMotion,
}: {
  card: WalletCard;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.article
      key={card.id}
      initial={reduceMotion ? false : { opacity: 0, x: 20, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: 12, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="overflow-hidden rounded-[1.35rem] border border-primary/30 bg-white shadow-[0_32px_70px_-18px_rgba(109,40,217,0.35)] ring-2 ring-primary/20 dark:border-primary/25 dark:bg-[rgba(12,12,20,0.96)]"
    >
      <div
        className="border-b border-border/50 px-5 py-5 sm:px-6"
        style={{
          background: card.colorHex
            ? `linear-gradient(135deg, ${card.colorHex}28 0%, transparent 60%)`
            : undefined,
        }}
      >
        <div className="flex items-start gap-4">
          <CardThumbnail
            name={card.name}
            issuer={card.issuer}
            last4={card.last4}
            colorHex={card.colorHex}
            imageUrl={card.catalogImageUrl}
            size="lg"
            className="shadow-2xl ring-1 ring-black/10"
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-lg font-semibold tracking-tight sm:text-xl">
              {card.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {card.issuer}
              {card.last4 ? ` · •••• ${card.last4}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {card.catalogLinked ? (
                <Badge
                  variant="secondary"
                  className="bg-primary/12 text-[10px] text-primary"
                >
                  Auto rewards
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Manual
                </Badge>
              )}
              {card.hasOfficialPdfExtract && (
                <Badge className="bg-blue-500/12 text-[10px] text-blue-700 dark:text-blue-300">
                  Issuer PDF
                </Badge>
              )}
              {!card.isActive && (
                <Badge variant="outline" className="text-[10px]">
                  Inactive
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <CardRewardsBody card={card} />
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="gradient" size="sm" asChild>
            <Link href={`/cards/${card.id}`}>Open card</Link>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

function EmptyDetailPanel() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-violet-500/25 bg-gradient-to-br from-violet-500/[0.04] to-transparent px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-5" />
      </div>
      <p className="mt-4 text-sm font-medium">Select a card</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Hover a card on the left to preview rewards, credits, and protections here.
      </p>
    </div>
  );
}

export function WalletStack({ cards }: Props) {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeCard = cards.find((c) => c.id === activeId) ?? null;
  /** Tighter list rows so ~8+ cards fit without scrolling the page. */
  const compactList = cards.length >= 6;
  const thumbSize = compactList ? "xs" : "sm";

  if (cards.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-dashed border-violet-500/30 bg-gradient-to-br from-violet-500/[0.06] via-card to-blue-500/[0.04] px-6 py-14 text-center"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_200px_at_50%_0%,rgba(109,40,217,0.12),transparent)]" />
        <div className="relative mx-auto max-w-sm">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Plus className="size-7" strokeWidth={2} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Your wallet is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your first card — we pull rewards from the issuer automatically.
          </p>
          <Button variant="gradient" size="lg" className="mt-6" asChild>
            <Link href="/cards/new">Add a card</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-6xl"
      onMouseLeave={() => setActiveId(null)}
    >
      <div
        className={cn(
          "grid gap-5 lg:items-start lg:gap-8",
          compactList
            ? "lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]"
            : "lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]",
        )}
      >
        {/* Left — card headers */}
        <ul
          className={cn(compactList ? "space-y-1" : "space-y-2")}
          role="list"
        >
          {cards.map((card, index) => {
            const isActive = activeId === card.id;

            return (
              <motion.li
                key={card.id}
                initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: reduceMotion ? 0 : index * 0.05,
                  type: "spring",
                  stiffness: 400,
                  damping: 28,
                }}
              >
                <button
                  type="button"
                  onMouseEnter={() => setActiveId(card.id)}
                  onFocus={() => setActiveId(card.id)}
                  onClick={() => setActiveId(card.id)}
                  className={cn(
                    "group relative flex w-full items-center overflow-hidden border text-left",
                    compactList
                      ? "gap-2 rounded-lg px-2 py-1.5"
                      : "gap-2.5 rounded-xl px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5",
                    reduceMotion
                      ? undefined
                      : "transition-[box-shadow,border-color,background-color] duration-200 ease-out",
                    isActive
                      ? "border-primary/40 bg-white shadow-[0_8px_24px_-10px_rgba(109,40,217,0.4)] ring-1 ring-primary/25 dark:bg-[rgba(12,12,20,0.92)]"
                      : "border-border/70 bg-card/80 shadow-sm hover:border-violet-500/30 hover:bg-white hover:shadow-md dark:bg-[rgba(12,12,20,0.55)]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary transition-opacity duration-200",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50",
                    )}
                    aria-hidden
                  />
                  <CardThumbnail
                    name={card.name}
                    issuer={card.issuer}
                    last4={card.last4}
                    colorHex={card.colorHex}
                    imageUrl={card.catalogImageUrl}
                    size={thumbSize}
                    className={cn(
                      "shrink-0 shadow-sm ring-1 ring-black/10",
                      !reduceMotion &&
                        !compactList &&
                        "transition-transform duration-200 group-hover:-rotate-1 group-hover:scale-[1.03]",
                      !reduceMotion && !compactList && isActive && "-rotate-1 scale-[1.03]",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h3
                        className={cn(
                          "truncate font-semibold tracking-tight",
                          compactList ? "text-xs" : "text-sm",
                        )}
                      >
                        {card.name}
                      </h3>
                      <ChevronRight
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground/40 transition",
                          isActive
                            ? "translate-x-0.5 text-primary"
                            : "group-hover:translate-x-0.5 group-hover:text-primary/70",
                        )}
                      />
                    </div>
                    <p
                      className={cn(
                        "truncate text-muted-foreground",
                        compactList ? "text-[10px] leading-tight" : "text-xs",
                      )}
                    >
                      {card.issuer}
                      {card.last4 ? ` · ${card.last4}` : ""}
                    </p>
                  </div>
                </button>
              </motion.li>
            );
          })}
        </ul>

        {/* Right — detail panel (desktop) */}
        <div className="hidden min-h-[280px] lg:block lg:sticky lg:top-24">
          <AnimatePresence mode="wait">
            {activeCard ? (
              <CardDetailPanel
                key={activeCard.id}
                card={activeCard}
                reduceMotion={reduceMotion}
              />
            ) : (
              <motion.div
                key="empty"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <EmptyDetailPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile — detail below list */}
      <div className="lg:hidden">
        <AnimatePresence mode="wait">
          {activeCard ? (
            <CardDetailPanel
              key={`mobile-${activeCard.id}`}
              card={activeCard}
              reduceMotion={reduceMotion}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
