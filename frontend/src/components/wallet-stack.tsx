"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Plus } from "lucide-react";
import { CardIntelProgress } from "@/components/card-intel-progress";
import { CardThumbnail } from "@/components/CardThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MappedIntelJob } from "@/lib/map-credit-card";
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
  };
  catalogImageUrl?: string | null;
};

type Props = {
  cards: WalletCard[];
};

export function WalletStack({ cards }: Props) {
  const reduceMotion = useReducedMotion();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  const anyHovered = hoveredId !== null;

  return (
    <div className="relative mx-auto max-w-lg pt-2 pb-4 md:max-w-2xl md:pt-4 md:pb-8">
      <div className="pointer-events-none absolute inset-x-4 -top-1 h-8 rounded-t-[2rem] bg-gradient-to-b from-zinc-900/8 to-transparent dark:from-white/10" />

      <ul className="relative isolate space-y-0">
        {cards.map((card, index) => {
          const isHovered = hoveredId === card.id;
          const hoveredIndex =
            hoveredId != null
              ? cards.findIndex((c) => c.id === hoveredId)
              : -1;
          const stackOffset = index * (reduceMotion ? 0 : 12);
          const baseZ = cards.length - index;
          const stacksAboveHovered =
            anyHovered && hoveredIndex >= 0 && index < hoveredIndex;
          const zIndex = isHovered ? 1000 : stacksAboveHovered ? 1 : baseZ;
          const animateY = isHovered ? -12 : stackOffset;

          return (
            <li
              key={card.id}
              style={{
                zIndex,
                position: "relative",
                transform: `translateY(${animateY}px) scale(${isHovered ? 1.02 : 1})`,
                transition: reduceMotion
                  ? undefined
                  : "transform 0.2s ease-out",
              }}
              onMouseEnter={() => setHoveredId(card.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                index > 0 && !isHovered && "-mt-8 sm:-mt-10",
                isHovered && "relative z-[1000] -mt-4 sm:-mt-6 md:mb-3",
                stacksAboveHovered && "pointer-events-none",
              )}
            >
              <Link href={`/cards/${card.id}`} className="group block">
                <article
                  className={cn(
                    "overflow-hidden rounded-[1.35rem] border backdrop-blur-xl transition-[box-shadow,border-color,transform] duration-200",
                    isHovered
                      ? "border-primary/35 bg-white shadow-[0_32px_70px_-18px_rgba(109,40,217,0.42)] ring-2 ring-primary/25 dark:border-primary/30 dark:bg-[rgba(12,12,20,0.96)]"
                      : "border-white/60 bg-white/75 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] dark:border-white/[0.08] dark:bg-[rgba(12,12,20,0.72)] hover:shadow-[0_28px_60px_-20px_rgba(109,40,217,0.28)]",
                  )}
                >
                  <div
                    className="relative px-4 pb-3 pt-4 sm:px-5 sm:pt-5"
                    style={{
                      background: card.colorHex
                        ? `linear-gradient(135deg, ${card.colorHex}22 0%, transparent 55%)`
                        : undefined,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="transition-transform duration-200 group-hover:scale-[1.03] group-hover:-rotate-1">
                        <CardThumbnail
                          name={card.name}
                          issuer={card.issuer}
                          last4={card.last4}
                          colorHex={card.colorHex}
                          imageUrl={card.catalogImageUrl}
                          size="lg"
                          className="shadow-2xl ring-1 ring-black/10"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3
                              className={cn(
                                "text-base font-semibold tracking-tight sm:text-lg",
                                isHovered ? "whitespace-normal" : "truncate",
                              )}
                            >
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
                          <p
                            className={cn(
                              "mt-2 text-[11px] text-muted-foreground",
                              !isHovered && "line-clamp-2",
                            )}
                          >
                            {card.walletPreview.benefitsSummary}
                          </p>
                        )}
                        {(card.walletPreview.statementCredits?.length ??
                          card.walletPreview.statementCreditHints.length) > 0 && (
                          <ul className="mt-2.5 space-y-2">
                            {(card.walletPreview.statementCredits?.length
                              ? card.walletPreview.statementCredits
                              : card.walletPreview.statementCreditHints.map(
                                  (hint) => ({
                                    title: hint,
                                    amountText: null,
                                    cadence: null,
                                    merchantHint: null,
                                    enrollmentRequired: false,
                                    detail: null,
                                  }),
                                )
                            )
                              .slice(0, isHovered ? undefined : 4)
                              .map((c) => (
                                <li
                                  key={`${c.title}-${c.amountText}-${c.cadence}`}
                                  className={cn(
                                    "text-[11px] text-amber-900/85 dark:text-amber-100/85",
                                    !isHovered && "line-clamp-3",
                                  )}
                                >
                                  <span className="font-medium text-amber-950 dark:text-amber-50">
                                    {c.title}
                                  </span>
                                  {c.amountText || c.cadence ? (
                                    <span className="text-amber-800/90 dark:text-amber-200/90">
                                      {" "}
                                      · {[c.amountText, c.cadence]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  ) : null}
                                  {c.detail ? (
                                    <span className="mt-0.5 block text-[10px] opacity-90">
                                      {c.detail}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                          </ul>
                        )}
                        {card.walletPreview.protectionHints.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {card.walletPreview.protectionHints
                              .slice(0, isHovered ? undefined : 2)
                              .map((hint) => (
                                <li
                                  key={hint}
                                  className={cn(
                                    "text-[11px] text-sky-900/85 dark:text-sky-100/85",
                                    !isHovered && "line-clamp-2",
                                  )}
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
