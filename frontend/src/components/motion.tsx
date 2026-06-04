"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

type FadeInProps = HTMLMotionProps<"div"> & {
  delay?: number;
};

/** Fade + slide up; respects prefers-reduced-motion. */
export function FadeIn({ className, delay = 0, ...props }: FadeInProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? undefined
          : { duration: 0.22, delay, ease: EASE }
      }
      {...props}
    />
  );
}

type StaggerProps = {
  children: ReactNode;
  className?: string;
};

/** Staggers direct motion children (use with motion.div variants). */
export function Stagger({ children, className }: StaggerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="show"
      variants={reduceMotion ? undefined : staggerContainer}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  className,
  ...props
}: HTMLMotionProps<"div">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      variants={reduceMotion ? undefined : fadeInUp}
      {...props}
    />
  );
}

export { motion };
