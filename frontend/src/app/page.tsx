import Link from "next/link";

export default function HomePage() {
  return (
    <div className="motion-enter space-y-14 py-6 md:py-10">
      <section className="space-y-6 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-600 dark:text-violet-400">
          SlyPay · In-store & online
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
          The right card before Apple Pay or Google Pay.
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 sm:mx-0">
          Walk into a store, let SlyPay read your location, and get an explainable
          pick for points and cashback. Confirm the card, then pay at the
          terminal with your digital wallet using the matching physical card.
        </p>
        <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
          <Link
            href="/register"
            className="rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-zinc-300/80 bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm backdrop-blur-xl transition hover:border-violet-400/40 dark:border-zinc-700 dark:text-zinc-50 dark:hover:border-violet-800/40"
          >
            Sign in
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            t: "Nearby businesses",
            d: "OpenStreetMap plus optional Google Places discover restaurants, shops, fuel, and more near you.",
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
          <div
            key={x.t}
            className="rounded-3xl border border-zinc-200/70 bg-[var(--surface)] p-6 shadow-md backdrop-blur-xl dark:border-zinc-800/80"
          >
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{x.t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {x.d}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
