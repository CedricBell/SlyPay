"use client";

import { BorderBeam } from "@/components/ui/border-beam";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

const BEAM_PALETTES = [
  { from: "#7c3aed", to: "#2563eb", delay: 0 },
  { from: "#2563eb", to: "#06b6d4", delay: 2.5 },
  { from: "#06b6d4", to: "#a855f7", delay: 5 },
] as const;

type Props = {
  title: string;
  description: string;
  /** Stagger beam animation per card (0–2). */
  index?: number;
  className?: string;
};

export function AnimatedFeatureCard({
  title,
  description,
  index = 0,
  className,
}: Props) {
  const palette = BEAM_PALETTES[index % BEAM_PALETTES.length];

  return (
    <SurfaceCard
      disableMotion
      className={cn(
        "relative overflow-hidden border-border/50 bg-card/95 backdrop-blur-none",
        "dark:border-violet-500/15 dark:bg-card/90",
        className,
      )}
    >
      <BorderBeam
        duration={14}
        delay={palette.delay}
        colorFrom={palette.from}
        colorTo={palette.to}
        borderWidth={1.5}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-violet-500/[0.04] via-transparent to-blue-500/[0.06]"
        aria-hidden
      />
      <CardHeader className="relative">
        <CardTitle className="text-base tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="relative pt-0">
        <CardDescription className="leading-relaxed">{description}</CardDescription>
      </CardContent>
    </SurfaceCard>
  );
}
