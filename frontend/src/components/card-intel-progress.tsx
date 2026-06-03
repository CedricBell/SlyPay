"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { intelStatusLabel } from "@/lib/card-intel-status";
import type { MappedIntelJob } from "@/lib/map-credit-card";
import { cn } from "@/lib/utils";

type Props = {
  intelJob: MappedIntelJob | null;
  pdfSummary: string | null;
  creditHints: string[];
  ruleHighlights: string[];
  className?: string;
};

export function CardIntelProgress({
  intelJob,
  pdfSummary,
  creditHints,
  ruleHighlights,
  className,
}: Props) {
  const hasLiveExtract = Boolean(pdfSummary || creditHints.length);
  const hasRules = ruleHighlights.length > 0;
  const label = intelStatusLabel(intelJob, hasLiveExtract);
  const failed =
    intelJob?.status === "FAILED" || intelJob?.status === "SKIPPED_NO_SOURCE";

  if (hasRules) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 via-transparent to-blue-500/8 p-4",
        failed && "border-amber-500/25 from-amber-500/8",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <motion.span
          animate={failed ? undefined : { rotate: 360 }}
          transition={
            failed
              ? undefined
              : { duration: 1.2, repeat: Infinity, ease: "linear" }
          }
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            failed
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-primary/12 text-primary",
          )}
        >
          {failed ? (
            <Sparkles className="size-4" strokeWidth={2.25} />
          ) : (
            <Loader2 className="size-4" strokeWidth={2.25} />
          )}
        </motion.span>
        <div className="min-w-0 flex-1 space-y-2">
          <p
            className={cn(
              "text-sm font-medium",
              failed ? "text-amber-900 dark:text-amber-100" : "text-foreground",
            )}
          >
            {label}
          </p>
          {!failed && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/60">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                initial={{ width: "8%" }}
                animate={{ width: hasLiveExtract ? "78%" : "42%" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          )}
        </div>
      </div>

      {(pdfSummary || creditHints.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 space-y-2 border-t border-border/50 pt-3"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <CheckCircle2 className="size-3.5" />
            Live from issuer document
          </p>
          {pdfSummary ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {pdfSummary}
            </p>
          ) : null}
          {creditHints.length > 0 ? (
            <ul className="space-y-1">
              {creditHints.slice(0, 3).map((hint) => (
                <li
                  key={hint}
                  className="text-xs text-amber-900/90 dark:text-amber-100/90"
                >
                  {hint}
                </li>
              ))}
            </ul>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}
