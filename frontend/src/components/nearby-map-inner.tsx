"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const mapCenter = useMemo(
    () => ({ lat: searchLat, lng: searchLng }),
    [searchLat, searchLng],
  );

  useEffect(() => {
    searchCenterRef.current = { lat: searchLat, lng: searchLng };
    setShowSearchHere(false);
    const map = mapRef.current;
    if (!map) return;
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
  }, [searchLat, searchLng, matches, gpsLat, gpsLng]);

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
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
            variant="default"
            disabled={geoLoading}
            onClick={handleSearchHere}
            className="pointer-events-auto gap-1.5 rounded-full border border-border/60 bg-background/95 px-4 shadow-lg backdrop-blur-md hover:bg-background dark:bg-card/95"
          >
            <Search className="size-3.5" />
            Search this area
          </Button>
        </div>
      ) : null}

      <GoogleMap
        mapContainerStyle={mapStyles}
        center={mapCenter}
        zoom={16}
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
