"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Plus } from "lucide-react";
import { CardIntelProgress } from "@/components/card-intel-progress";
import { CardThumbnail } from "@/components/CardThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MappedIntelJob } from "@/lib/map-credit-card";
import { intelHasFailed } from "@/lib/card-intel-status";
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
    protectionHints: string[];
  };
  catalogImageUrl?: string | null;
};

type Props = {
  cards: WalletCard[];
};

export function WalletStack({ cards }: Props) {
  const reduceMotion = useReducedMotion();

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
    <div className="relative mx-auto max-w-lg pt-2 pb-4">
      {/* Wallet shell */}
      <div className="pointer-events-none absolute inset-x-4 -top-1 h-8 rounded-t-[2rem] bg-gradient-to-b from-zinc-900/8 to-transparent dark:from-white/10" />

      <ul className="relative space-y-0">
        {cards.map((card, index) => {
          const stackOffset = index * (reduceMotion ? 0 : 12);
          const zIndex = cards.length - index;

          return (
            <motion.li
              key={card.id}
              layout
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{
                opacity: 1,
                y: stackOffset,
              }}
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 32,
                delay: index * 0.06,
              }}
              whileHover={
                reduceMotion
                  ? undefined
                  : {
                      y: stackOffset - 6,
                      scale: 1.012,
                      transition: { type: "spring", stiffness: 400, damping: 28 },
                    }
              }
              style={{ zIndex }}
              className={cn(index > 0 && "-mt-8 sm:-mt-10")}
            >
              <Link
                href={`/cards/${card.id}`}
                className="group block"
              >
                <article
                  className={cn(
                    "overflow-hidden rounded-[1.35rem] border border-white/60 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-shadow",
                    "bg-white/75 dark:border-white/[0.08] dark:bg-[rgba(12,12,20,0.72)]",
                    "hover:shadow-[0_28px_60px_-20px_rgba(109,40,217,0.28)]",
                  )}
                >
                  {/* Card face strip */}
                  <div
                    className="relative px-4 pb-3 pt-4 sm:px-5 sm:pt-5"
                    style={{
                      background: card.colorHex
                        ? `linear-gradient(135deg, ${card.colorHex}22 0%, transparent 55%)`
                        : undefined,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <motion.div
                        whileHover={reduceMotion ? undefined : { rotate: -2, scale: 1.03 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22 }}
                      >
                        <CardThumbnail
                          name={card.name}
                          issuer={card.issuer}
                          last4={card.last4}
                          colorHex={card.colorHex}
                          imageUrl={card.catalogImageUrl}
                          size="lg"
                          className="shadow-2xl ring-1 ring-black/10"
                        />
                      </motion.div>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                              {card.name}
                            </h3>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {card.issuer}
                              {card.last4 ? ` · •••• ${card.last4}` : ""}
                            </p>
                          </div>
                          <ChevronRight className="size-5 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
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

                  {/* Details panel */}
                  <div className="border-t border-border/50 px-4 py-3.5 sm:px-5">
                    {card.walletScoreAnalyzing ? (
                      <CardIntelProgress
                        intelJob={card.intelJob}
                        pdfSummary={card.walletPreview.pdfSummary}
                        creditHints={card.walletPreview.statementCreditHints}
                        ruleHighlights={card.walletPreview.ruleHighlights}
                      />
                    ) : intelHasFailed(card.intelJob) &&
                      card.walletPreview.ruleHighlights.length === 0 ? (
                      <CardIntelProgress
                        intelJob={card.intelJob}
                        pdfSummary={card.walletPreview.pdfSummary}
                        creditHints={card.walletPreview.statementCreditHints}
                        ruleHighlights={[]}
                      />
                    ) : card.walletPreview.ruleHighlights.length > 0 ? (
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
                        {card.walletPreview.benefitsSummary && (
                          <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                            {card.walletPreview.benefitsSummary}
                          </p>
                        )}
                        {card.walletPreview.statementCreditHints.length > 0 && (
                          <ul className="mt-2.5 space-y-1">
                            {card.walletPreview.statementCreditHints
                              .slice(0, 3)
                              .map((hint) => (
                                <li
                                  key={hint}
                                  className="line-clamp-2 text-[11px] text-amber-900/85 dark:text-amber-100/85"
                                >
                                  {hint}
                                </li>
                              ))}
                          </ul>
                        )}
                        {card.walletPreview.protectionHints.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {card.walletPreview.protectionHints
                              .slice(0, 2)
                              .map((hint) => (
                                <li
                                  key={hint}
                                  className="line-clamp-2 text-[11px] text-sky-900/85 dark:text-sky-100/85"
                                >
                                  {hint}
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No reward rules yet — tap to configure.
                      </p>
                    )}
                  </div>
                </article>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
