"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { intelProgressState, INTEL_RUNNING_STEPS } from "@/lib/card-intel-status";
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
  const failed =
    intelJob?.status === "FAILED" || intelJob?.status === "SKIPPED_NO_SOURCE";

  const isActive =
    !failed &&
    !hasRules &&
    (!intelJob ||
      intelJob.status === "PENDING" ||
      intelJob.status === "RUNNING");

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNowMs(Date.now()), 320);
    return () => clearInterval(id);
  }, [isActive]);

  if (hasRules) return null;

  const { stepIndex, stepCount, activeStepFill, label } = intelProgressState(
    intelJob,
    hasLiveExtract,
    nowMs,
  );

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
        <div className="min-w-0 flex-1 space-y-3">
          <p
            className={cn(
              "text-sm font-medium",
              failed ? "text-amber-900 dark:text-amber-100" : "text-foreground",
            )}
          >
            {label}
          </p>

          {!failed && (
            <ol
              className="flex gap-1.5"
              aria-label={`Step ${stepIndex + 1} of ${stepCount}`}
            >
              {INTEL_RUNNING_STEPS.map((step, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                const fill =
                  done ? 1 : active ? Math.max(0.12, activeStepFill) : 0;
                return (
                  <li
                    key={step}
                    title={step}
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/70"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-300 ease-out",
                        done || active ? "bg-violet-500" : "bg-transparent",
                      )}
                      style={{ width: `${fill * 100}%` }}
                    />
                  </li>
                );
              })}
            </ol>
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
