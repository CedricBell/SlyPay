"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Animated aurora blobs — clean, no dot grid. */
export function AppBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#f8f9fc] dark:bg-[#030308]" />

      {!reduceMotion && (
        <>
          <motion.div
            className="absolute -left-[15%] -top-[10%] size-[min(85vw,640px)] rounded-full opacity-[0.45] blur-[100px] dark:opacity-[0.28]"
            style={{
              background:
                "radial-gradient(circle at center, #7c3aed 0%, transparent 68%)",
            }}
            animate={{
              x: [0, 80, 30, 0],
              y: [0, 50, 90, 0],
              scale: [1, 1.08, 0.96, 1],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -right-[10%] top-[5%] size-[min(75vw,560px)] rounded-full opacity-[0.38] blur-[100px] dark:opacity-[0.22]"
            style={{
              background:
                "radial-gradient(circle at center, #2563eb 0%, transparent 68%)",
            }}
            animate={{
              x: [0, -70, -25, 0],
              y: [0, 70, 35, 0],
              scale: [1, 0.94, 1.06, 1],
            }}
            transition={{
              duration: 26,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-[-15%] left-[25%] size-[min(70vw,520px)] rounded-full opacity-[0.3] blur-[90px] dark:opacity-[0.18]"
            style={{
              background:
                "radial-gradient(circle at center, #a78bfa 0%, transparent 68%)",
            }}
            animate={{
              x: [0, 50, -40, 0],
              y: [0, -40, 25, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </>
      )}

      {/* Soft vignette — keeps content readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-[#f8f9fc] dark:from-black/20 dark:to-[#030308]" />
    </div>
  );
}
