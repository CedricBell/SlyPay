"use client";

import dynamic from "next/dynamic";
import type { NearbyMatch } from "@/lib/nearby-types";

const NearbyMapInner = dynamic(
  () =>
    import("./nearby-map-inner").then((m) => ({ default: m.NearbyMapInner })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(420px,55vh)] min-h-[280px] items-center justify-center rounded-2xl bg-muted/40">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

type Props = {
  gpsLat: number | null;
  gpsLng: number | null;
  searchLat: number;
  searchLng: number;
  matches: NearbyMatch[];
  selectedKey: string | null;
  onSelect: (match: NearbyMatch) => void;
  onSearchThisArea: (lat: number, lng: number) => void;
  geoLoading?: boolean;
};

export function NearbyMap(props: Props) {
  return (
    <div className="h-[min(420px,55vh)] min-h-[280px] overflow-hidden rounded-2xl ring-1 ring-border/60">
      <NearbyMapInner {...props} />
    </div>
  );
}
