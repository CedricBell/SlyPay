"use client";

import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
  reverse?: boolean;
  initialOffset?: number;
  borderWidth?: number;
  borderRadius?: number;
}

/**
 * Animated border highlight — CSS transform rotation (compositor-friendly).
 * Avoids offset-path, which stutters on rounded corners.
 */
export const BorderBeam = ({
  className,
  duration = 10,
  delay = 0,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  reverse = false,
  borderWidth = 1.5,
}: BorderBeamProps) => {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] border border-primary/25",
          className,
        )}
        style={{ borderWidth }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "border-beam pointer-events-none absolute inset-0 isolate overflow-hidden rounded-[inherit]",
        className,
      )}
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
          "--border-beam-duration": `${duration}s`,
          "--border-beam-delay": `${-delay}s`,
          "--border-beam-from": colorFrom,
          "--border-beam-to": colorTo,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "border-beam-glow",
          reverse && "border-beam-glow-reverse",
        )}
      />
    </div>
  );
};
