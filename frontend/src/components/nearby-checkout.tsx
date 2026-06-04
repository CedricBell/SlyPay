"use client";

import { MapPin, Navigation, RefreshCw } from "lucide-react";
import { MerchantInput } from "@/components/MerchantInput";
import { RecommendationCard } from "@/components/RecommendationCard";
import { NearbyPlacesView } from "@/components/nearby-places-view";
import { StatusMessage } from "@/components/status-message";
import { CategoryChip } from "@/components/category-chip";
import { SpendCategoryIcon } from "@/components/spend-category-icon";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useNearbyCheckout } from "@/hooks/use-nearby-checkout";
import { cn } from "@/lib/utils";
import { displayName, matchCategory } from "@/lib/nearby-types";

export function NearbyCheckout() {
  const checkout = useNearbyCheckout();
  const {
    merchant,
    setMerchant,
    onMerchantPick,
    result,
    loading,
    err,
    geoLoading,
    geoMsg,
    hasLocation,
    nearby,
    gpsLat,
    gpsLng,
    searchLat,
    searchLng,
    selectedMatch,
    setActiveTier,
    oneTapBanner,
    setOneTapBanner,
    setPlaceCategoryHint,
    selectedKey,
    applyMatch,
    runRecommendation,
    detectNearby,
    searchThisArea,
  } = checkout;

  const selectedCategory = selectedMatch ? matchCategory(selectedMatch) : null;

  return (
    <section id="nearby" className="scroll-mt-24 space-y-6">
      {oneTapBanner ? (
        <StatusMessage
          variant="info"
          className="border-primary/30 bg-primary/5 font-medium text-primary"
        >
          {oneTapBanner}
        </StatusMessage>
      ) : null}

      <SurfaceCard className="overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/[0.07] via-card to-blue-500/[0.05] p-0">
        <div className="border-b border-border/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="size-4.5" strokeWidth={2.25} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Pay nearby
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Find stores around you and pick the best card
                  </p>
                </div>
              </div>
              {selectedMatch ? (
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <SpendCategoryIcon
                    category={selectedCategory}
                    size="sm"
                    selected
                  />
                  <span className="text-sm font-medium text-foreground">
                    {displayName(selectedMatch)}
                  </span>
                  <CategoryChip category={selectedCategory} />
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant={hasLocation ? "outline" : "gradient"}
              onClick={() => void detectNearby()}
              disabled={geoLoading}
              className="shrink-0 gap-2"
            >
              {hasLocation ? (
                <RefreshCw className={cn("size-4", geoLoading && "animate-spin")} />
              ) : (
                <Navigation className="size-4" />
              )}
              {geoLoading
                ? "Detecting…"
                : hasLocation
                  ? "Refresh"
                  : "Use my location"}
            </Button>
          </div>
          {geoMsg ? (
            <p className="mt-3 text-xs text-muted-foreground">{geoMsg}</p>
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          <NearbyPlacesView
            gpsLat={gpsLat}
            gpsLng={gpsLng}
            searchLat={searchLat}
            searchLng={searchLng}
            matches={nearby}
            selectedKey={selectedKey}
            geoLoading={geoLoading}
            onRequestLocation={() => void detectNearby()}
            onSearchThisArea={(lat, lng) => void searchThisArea(lat, lng)}
            onSelect={(m) => {
              applyMatch(m);
              setOneTapBanner(null);
            }}
          />
        </div>
      </SurfaceCard>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runRecommendation();
        }}
        className="space-y-6"
      >
        <SurfaceCard className="p-4 sm:p-5">
          <MerchantInput
            value={merchant}
            onChange={setMerchant}
            onUserInput={() => setPlaceCategoryHint(null)}
            onPick={onMerchantPick}
          />
        </SurfaceCard>

        {err ? (
          <StatusMessage variant="error">
            <pre className="overflow-x-auto text-xs">{err}</pre>
          </StatusMessage>
        ) : null}

        <Button
          type="submit"
          variant="gradient"
          size="xl"
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? "Computing…" : "Get recommendation"}
        </Button>
      </form>

      {result ? (
        <RecommendationCard
          resolvedCategory={result.resolvedCategory}
          evaluationDate={result.evaluationDate}
          bestCard={result.bestCard}
          bestCardBenefits={result.bestCardBenefits}
          reasoning={result.reasoning}
          ranked={result.ranked}
          alternatesTied={result.alternatesTied}
          trace={result.categoryResolution.trace}
          marketBest={result.marketBest}
          recommendationId={result.recommendationId}
          merchantLabel={merchant.trim() || null}
        />
      ) : null}
    </section>
  );
}
