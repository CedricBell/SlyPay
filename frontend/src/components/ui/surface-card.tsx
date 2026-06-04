"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function SurfaceCard({
  className,
  disableMotion,
  ...props
}: React.ComponentProps<typeof Card> & { disableMotion?: boolean }) {
  const reduceMotion = useReducedMotion();
  const motionOff = disableMotion || reduceMotion;

  const card = (
      <Card
        className={cn(
          "rounded-3xl border border-border/70 bg-card/70 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.14)] backdrop-blur-2xl backdrop-saturate-150",
          "ring-0 transition-shadow duration-300 hover:border-violet-500/25 hover:shadow-[0_16px_48px_-16px_rgba(109,40,217,0.18)]",
          "dark:border-violet-500/12 dark:bg-[rgba(18,18,28,0.55)] dark:hover:border-violet-500/30 dark:hover:shadow-[0_16px_48px_-16px_rgba(139,92,246,0.25)]",
          className,
        )}
        {...props}
      />
  );

  if (motionOff) {
    return card;
  }

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      {card}
    </motion.div>
  );
}

export { SurfaceCard };
