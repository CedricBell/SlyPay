"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { CategoryChip } from "@/components/category-chip";
import { SpendCategoryIcon } from "@/components/spend-category-icon";
import { cn } from "@/lib/utils";
import {
  displayName,
  matchCategory,
  placeKey,
  type NearbyMatch,
} from "@/lib/nearby-types";

type Props = {
  matches: NearbyMatch[];
  selectedKey: string | null;
  onSelect: (match: NearbyMatch) => void;
};

export function NearbyPlacesList({ matches, selectedKey, onSelect }: Props) {
  if (matches.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 text-center">
        <MapPin className="size-8 text-muted-foreground/60" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-foreground">
          No places detected yet
        </p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Allow location or tap refresh to find stores and restaurants around you.
        </p>
      </div>
    );
  }

  return (
    <ul className="max-h-[min(420px,55vh)] space-y-2 overflow-y-auto pr-1">
      {matches.map((m, i) => {
        const key = placeKey(m);
        const selected = key === selectedKey;
        const category = matchCategory(m);

        return (
          <motion.li
            key={key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.25 }}
          >
            <button
              type="button"
              onClick={() => onSelect(m)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all",
                selected
                  ? "border-primary/40 bg-primary/[0.04] shadow-sm ring-1 ring-primary/20"
                  : "border-border/70 bg-card/60 hover:border-primary/20 hover:bg-card/90 hover:shadow-sm",
              )}
            >
              <SpendCategoryIcon
                category={category}
                size="md"
                selected={selected}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug text-foreground">
                  {displayName(m)}
                </span>
                <span className="mt-1.5 block">
                  <CategoryChip category={category} />
                </span>
              </span>
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}
