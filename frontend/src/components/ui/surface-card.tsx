"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function SurfaceCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -3, scale: 1.005 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <Card
        className={cn(
          "rounded-3xl border border-white/60 bg-white/55 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.14)] backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-black/[0.04] transition-shadow duration-300 hover:shadow-[0_16px_48px_-16px_rgba(109,40,217,0.18)]",
          "dark:border-white/[0.08] dark:bg-[rgba(18,18,28,0.55)] dark:ring-white/[0.06] dark:hover:shadow-[0_16px_48px_-16px_rgba(139,92,246,0.25)]",
          className,
        )}
        {...props}
      />
    </motion.div>
  );
}

export { SurfaceCard };
