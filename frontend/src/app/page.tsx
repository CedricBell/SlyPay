import Link from "next/link";

import { AnimatedFeatureCard } from "@/components/animated-feature-card";
import { Stagger, MotionItem } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

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

      <Stagger className="grid gap-4 sm:grid-cols-2">
        {[
          {
            t: "Nearby businesses",
            d: "OpenStreetMap plus optional Google Places discover restaurants, shops, fuel, and more near you.",
          },
          {
            t: "Rewards math",
            d: "Your rules and limited-time offers are stacked with clear reasoning—not a generic blog ranking.",
          },
        ].map((x, i) => (
          <MotionItem key={x.t}>
            <AnimatedFeatureCard title={x.t} description={x.d} index={i} />
          </MotionItem>
        ))}
      </Stagger>
    </div>
  );
}
