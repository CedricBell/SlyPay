"use client";

import { Gift, Shield, Sparkles, AlertTriangle, BadgeCheck } from "lucide-react";
import { StatusMessage } from "@/components/status-message";
import {
  buildContextualBenefitBullets,
  type CardSpendBenefits,
  type ContextualBenefitBullet,
} from "@/lib/recommendation-benefits";

const GROUP_META: Record<
  ContextualBenefitBullet["group"],
  { label: string; className: string; icon: typeof Sparkles }
> = {
  exclusion: {
    label: "Note",
    className: "text-amber-700 dark:text-amber-300",
    icon: AlertTriangle,
  },
  earn: {
    label: "Earn details",
    className: "text-violet-700 dark:text-violet-300",
    icon: Sparkles,
  },
  credit: {
    label: "Credits",
    className: "text-emerald-700 dark:text-emerald-400",
    icon: Gift,
  },
  protection: {
    label: "Coverage",
    className: "text-sky-700 dark:text-sky-400",
    icon: Shield,
  },
  perk: {
    label: "Perks",
    className: "text-indigo-700 dark:text-indigo-400",
    icon: BadgeCheck,
  },
  loyalty: {
    label: "Loyalty",
    className: "text-blue-700 dark:text-blue-400",
    icon: BadgeCheck,
  },
  caveat: {
    label: "Fine print",
    className: "text-muted-foreground",
    icon: AlertTriangle,
  },
};

type RotatingQuarter = {
  label: string;
  multiplier: number;
  details?: string;
};

type Props = {
  benefits: CardSpendBenefits;
  rotatingQuarters?: RotatingQuarter[] | null;
  /** Shown when there are no extra bullets beyond the rate in the parent header. */
  emptyHint?: string;
};

export function ContextualBenefitsList({
  benefits,
  rotatingQuarters,
  emptyHint,
}: Props) {
  const bullets = buildContextualBenefitBullets(benefits, {
    rotatingQuarters: rotatingQuarters ?? undefined,
  });

  if (!bullets.length) {
    if (emptyHint) {
      return (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      );
    }
    return null;
  }

  return (
    <ul className="space-y-2">
      {bullets.map((b, i) => {
        const meta = GROUP_META[b.group];
        const Icon = meta.icon;
        if (b.group === "exclusion") {
          return (
            <li key={`${b.group}-${i}`}>
              <StatusMessage variant="warning" className="text-xs">
                {b.text}
              </StatusMessage>
            </li>
          );
        }
        return (
          <li key={`${b.group}-${i}`} className="flex gap-2 text-sm">
            <Icon
              className={`mt-0.5 size-3.5 shrink-0 ${meta.className}`}
              aria-hidden
            />
            <span>{b.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
