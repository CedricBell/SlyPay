"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, List, Loader2, Map as MapIcon, Navigation } from "lucide-react";
import { NearbyMap } from "@/components/nearby-map";
import { NearbyPlacesList } from "@/components/nearby-places-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NearbyMatch } from "@/lib/nearby-types";

type ViewMode = "map" | "list";

type Props = {
  gpsLat: number | null;
  gpsLng: number | null;
  searchLat: number | null;
  searchLng: number | null;
  matches: NearbyMatch[];
  selectedKey: string | null;
  onSelect: (match: NearbyMatch) => void;
  geoLoading?: boolean;
  onRequestLocation?: () => void;
  onSearchThisArea?: (lat: number, lng: number) => void;
};

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const options: { id: ViewMode; label: string; icon: typeof MapIcon }[] = [
    { id: "map", label: "Map", icon: MapIcon },
    { id: "list", label: "List", icon: List },
  ];

  return (
    <div
      role="tablist"
      aria-label="Places view"
      className="inline-flex rounded-full border border-border/70 bg-muted/50 p-1 shadow-sm backdrop-blur-sm dark:bg-card/80"
    >
      {options.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-3.5",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="nearby-view-mode"
                className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border/60 dark:bg-card"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            ) : null}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className="size-3.5" strokeWidth={2.25} />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LocationPlaceholder({
  geoLoading,
  onRequestLocation,
}: {
  geoLoading?: boolean;
  onRequestLocation?: () => void;
}) {
  return (
    <div className="relative flex h-[min(420px,55vh)] min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-violet-500/[0.06] via-card to-blue-500/[0.05] px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.12),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.1),transparent_45%)]" />
      <div className="relative flex flex-col items-center">
        {geoLoading ? (
          <Loader2 className="size-10 animate-spin text-primary/70" strokeWidth={1.75} />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <LayoutGrid className="size-7" strokeWidth={1.5} />
          </span>
        )}
        <p className="mt-4 text-sm font-semibold text-foreground">
          {geoLoading ? "Finding places near you…" : "See what's around you"}
        </p>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
          {geoLoading
            ? "Loading the map and nearby merchants."
            : "Allow location access to show stores on the map and pick the best card."}
        </p>
        {!geoLoading && onRequestLocation ? (
          <Button
            type="button"
            variant="gradient"
            size="sm"
            className="mt-5 gap-2"
            onClick={() => void onRequestLocation()}
          >
            <Navigation className="size-4" />
            Use my location
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function NearbyPlacesView({
  gpsLat,
  gpsLng,
  searchLat,
  searchLng,
  matches,
  selectedKey,
  onSelect,
  geoLoading,
  onRequestLocation,
  onSearchThisArea,
}: Props) {
  const hasLocation = searchLat !== null && searchLng !== null;
  const [view, setView] = useState<ViewMode>("map");

  const placeLabel =
    matches.length === 0
      ? hasLocation
        ? "No places nearby"
        : "Location off"
      : matches.length === 1
        ? "1 place nearby"
        : `${matches.length} places nearby`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{placeLabel}</p>
        <ViewModeToggle value={view} onChange={setView} />
      </div>

      <div className="relative">
        {view === "map" ? (
          hasLocation ? (
            <div className="relative">
              <NearbyMap
                gpsLat={gpsLat}
                gpsLng={gpsLng}
                searchLat={searchLat}
                searchLng={searchLng}
                matches={matches}
                selectedKey={selectedKey}
                onSelect={onSelect}
                onSearchThisArea={(lat, lng) => onSearchThisArea?.(lat, lng)}
                geoLoading={geoLoading}
              />
              {geoLoading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/40 backdrop-blur-[2px]">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : null}
            </div>
          ) : (
            <LocationPlaceholder
              geoLoading={geoLoading}
              onRequestLocation={onRequestLocation}
            />
          )
        ) : (
          <NearbyPlacesList
            matches={matches}
            selectedKey={selectedKey}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  );
}
