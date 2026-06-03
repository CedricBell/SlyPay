import Link from "next/link";

import { Stagger, MotionItem } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SurfaceCard } from "@/components/ui/surface-card";

export default function HomePage() {
  return (
    <div className="space-y-14 py-6 md:py-10">
      <PageHeader
        eyebrow="SlyPay · In-store & online"
        title="The right card before Apple Pay or Google Pay."
        description="Walk into a store, let SlyPay read your location, and get an explainable pick for points and cashback. Confirm the card, then pay at the terminal with your digital wallet using the matching physical card."
      />
      <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
        <Button variant="gradient" size="xl" asChild>
          <Link href="/register">Create account</Link>
        </Button>
        <Button variant="outline" size="xl" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-3">
        {[
          {
            t: "Nearby businesses",
            d: "OpenStreetMap plus optional Google Places discover restaurants, shops, fuel, and more near you.",
            featured: true,
          },
          {
            t: "Rewards math",
            d: "Your rules and limited-time offers are stacked with clear reasoning—not a generic blog ranking.",
          },
          {
            t: "Wallet-ready",
            d: "After you confirm the card, step-by-step guidance for Apple Pay or Google Pay at the reader.",
          },
        ].map((x) => (
          <MotionItem key={x.t}>
            <SurfaceCard className="relative overflow-hidden">
              {"featured" in x && x.featured && (
                <BorderBeam
                  size={80}
                  duration={8}
                  colorFrom="#7c3aed"
                  colorTo="#2563eb"
                  borderWidth={1.5}
                />
              )}
              <CardHeader>
                <CardTitle className="text-base">{x.t}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="leading-relaxed">{x.d}</CardDescription>
              </CardContent>
            </SurfaceCard>
          </MotionItem>
        ))}
      </Stagger>
    </div>
  );
}
