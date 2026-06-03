"use client";

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { categoryLabelFromUi } from "@/lib/spend-category-ui";
import type { WalletOptimizationScore } from "@/lib/wallet-optimization-score";
import { cn } from "@/lib/utils";
import type { SpendCategory } from "@prisma/client";

type Props = {
  optimization: WalletOptimizationScore;
  className?: string;
};

export function WalletOptimizationPanel({ optimization, className }: Props) {
  const { overallPercent, hasCards, categories } = optimization;

  return (
    <div className={cn("space-y-5", className)}>
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-br from-violet-600/10 via-card to-blue-500/10 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_180px_at_0%_0%,rgba(109,40,217,0.15),transparent)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <TrendingUp className="size-3.5" />
              Wallet optimization
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              How close your cards are to the best available rates in our
              catalog, category by category.{" "}
              {hasCards
                ? "5% vs 10% cashback on a category = 50%."
                : "Add cards to calculate your score."}
            </p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold tabular-nums tracking-tight text-foreground">
              {hasCards ? `${overallPercent}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Overall score</p>
          </div>
        </div>
        {hasCards && (
          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-muted/60">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${overallPercent}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <ul className="space-y-2">
          {categories.map((row, i) => (
            <motion.li
              key={row.category}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-border/70 bg-card/50 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {categoryLabelFromUi(row.category as SpendCategory)}
                </span>
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    row.scorePercent >= 80
                      ? "text-emerald-600 dark:text-emerald-400"
                      : row.scorePercent >= 50
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {row.scorePercent}%
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>
                  Your best:{" "}
                  <span className="font-medium text-foreground">
                    {row.walletBestLabel}
                  </span>
                  {row.walletCardName ? ` · ${row.walletCardName}` : ""}
                </p>
                <p>
                  Market best:{" "}
                  <span className="font-medium text-foreground">
                    {row.marketBestLabel}
                  </span>
                  {row.marketCardName ? ` · ${row.marketCardName}` : ""}
                </p>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${row.scorePercent}%` }}
                />
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
