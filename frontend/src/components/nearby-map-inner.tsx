"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import { CategoryChip } from "@/components/category-chip";
import { Button } from "@/components/ui/button";
import { haversineMeters } from "@/lib/geo-utils";
import {
  displayName,
  matchCategory,
  placeKey,
  type NearbyMatch,
} from "@/lib/nearby-types";
import {
  categoryMapPinUrl,
  MAP_STYLES,
  userLocationPinUrl,
} from "@/lib/spend-category-ui";

const mapStyles = { width: "100%", height: "100%" };
const PAN_SEARCH_THRESHOLD_M = 180;

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

export function NearbyMapInner({
  gpsLat,
  gpsLng,
  searchLat,
  searchLng,
  matches,
  selectedKey,
  onSelect,
  onSearchThisArea,
  geoLoading,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "slypay-google-map",
    googleMapsApiKey: apiKey,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [showSearchHere, setShowSearchHere] = useState(false);
  const searchCenterRef = useRef({ lat: searchLat, lng: searchLng });
  /** True while a "Search this area" request is in flight (skip fit until it finishes). */
  const areaSearchLockRef = useRef(false);
  /** Stop passing center/zoom props so React does not reset zoom after pan/search. */
  const [cameraPropsReleased, setCameraPropsReleased] = useState(false);

  const fitMapToResults = useCallback(
    (map: google.maps.Map) => {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: searchLat, lng: searchLng });
      if (gpsLat != null && gpsLng != null) {
        bounds.extend({ lat: gpsLat, lng: gpsLng });
      }
      for (const m of matches) {
        bounds.extend({ lat: m.lat, lng: m.lng });
      }
      if (matches.length === 0) {
        map.setCenter({ lat: searchLat, lng: searchLng });
        map.setZoom(16);
      } else {
        map.fitBounds(bounds, 56);
      }
    },
    [gpsLat, gpsLng, matches, searchLat, searchLng],
  );

  useEffect(() => {
    searchCenterRef.current = { lat: searchLat, lng: searchLng };
    setShowSearchHere(false);
    const map = mapRef.current;
    if (!map) return;

    if (areaSearchLockRef.current) {
      if (!geoLoading) {
        areaSearchLockRef.current = false;
      }
      return;
    }

    fitMapToResults(map);
  }, [searchLat, searchLng, matches, geoLoading, fitMapToResults]);

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      fitMapToResults(map);
      setCameraPropsReleased(true);
    },
    [fitMapToResults],
  );

  const checkMapMoved = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    if (!c) return;
    const { lat, lng } = searchCenterRef.current;
    const dist = haversineMeters(c.lat(), c.lng(), lat, lng);
    setShowSearchHere(dist > PAN_SEARCH_THRESHOLD_M);
  }, []);

  const handleSearchHere = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    if (!c) return;
    setShowSearchHere(false);
    areaSearchLockRef.current = true;
    onSearchThisArea(c.lat(), c.lng());
  }, [onSearchThisArea]);

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl bg-muted/30 px-6 text-center text-sm text-muted-foreground">
        Set{" "}
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </code>{" "}
        to enable the map.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl bg-muted/30 px-6 text-center text-sm text-muted-foreground">
        Could not load Google Maps.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl bg-muted/30">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[280px]">
      {showSearchHere ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={geoLoading}
            onClick={handleSearchHere}
            className="pointer-events-auto gap-2 rounded-full border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-lg ring-1 ring-black/10 backdrop-blur-md hover:bg-muted dark:border-border dark:bg-card dark:text-foreground dark:ring-white/10 dark:hover:bg-muted/80 [&_svg]:text-foreground"
          >
            <Search className="size-4 shrink-0 opacity-90" aria-hidden />
            Search this area
          </Button>
        </div>
      ) : null}

      <GoogleMap
        mapContainerStyle={mapStyles}
        {...(cameraPropsReleased
          ? {}
          : { center: { lat: searchLat, lng: searchLng }, zoom: 16 })}
        onLoad={onMapLoad}
        onDragEnd={checkMapMoved}
        onZoomChanged={checkMapMoved}
        onIdle={checkMapMoved}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: MAP_STYLES,
        }}
      >
        {gpsLat != null && gpsLng != null ? (
          <Marker
            position={{ lat: gpsLat, lng: gpsLng }}
            title="You are here"
            icon={{
              url: userLocationPinUrl(),
              scaledSize: new google.maps.Size(28, 28),
              anchor: new google.maps.Point(14, 14),
            }}
            zIndex={1000}
          />
        ) : null}
        {matches.map((m) => {
          const key = placeKey(m);
          const selected = key === selectedKey;
          const open = infoKey === key;
          const category = matchCategory(m);
          const pinSize = selected
            ? new google.maps.Size(48, 56)
            : new google.maps.Size(42, 50);

          return (
            <Marker
              key={key}
              position={{ lat: m.lat, lng: m.lng }}
              onClick={() => {
                onSelect(m);
                setInfoKey(key);
              }}
              icon={{
                url: categoryMapPinUrl(category, selected),
                scaledSize: pinSize,
                anchor: new google.maps.Point(
                  pinSize.width / 2,
                  pinSize.height - 4,
                ),
              }}
              zIndex={selected ? 500 : 100}
            >
              {open ? (
                <InfoWindow
                  onCloseClick={() => setInfoKey(null)}
                  options={{ pixelOffset: new google.maps.Size(0, -4) }}
                >
                  <div className="min-w-[140px] space-y-2 py-0.5 pr-1">
                    <p className="text-sm font-semibold leading-snug text-gray-900">
                      {displayName(m)}
                    </p>
                    <CategoryChip category={category} />
                  </div>
                </InfoWindow>
              ) : null}
            </Marker>
          );
        })}
      </GoogleMap>
    </div>
  );
}
