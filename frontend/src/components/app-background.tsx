"use client";

import { useReducedMotion } from "framer-motion";

/** Lightweight aurora — CSS only (no continuous JS animation). */
export function AppBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#f8f9fc] dark:bg-[#030308]" />

      {!reduceMotion && (
        <>
          <div
            className="app-aurora-violet absolute -left-[15%] -top-[10%] size-[min(85vw,640px)] rounded-full opacity-[0.45] blur-[100px] dark:opacity-[0.28]"
            aria-hidden
          />
          <div
            className="app-aurora-blue absolute -right-[10%] top-[5%] size-[min(75vw,560px)] rounded-full opacity-[0.38] blur-[100px] dark:opacity-[0.22]"
            aria-hidden
          />
          <div
            className="app-aurora-lilac absolute bottom-[-15%] left-[25%] size-[min(70vw,520px)] rounded-full opacity-[0.3] blur-[90px] dark:opacity-[0.18]"
            aria-hidden
          />
        </>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-[#f8f9fc] dark:from-black/20 dark:to-[#030308]" />
    </div>
  );
}
