import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-12 py-6">
      <section className="space-y-4 text-center sm:text-left">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-600">
          Real-time credit card decision engine
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Use the right card at checkout—every time.
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          SlyPay combines your wallet rules, limited-time offers, and
          merchant signals (including MCC-style mappings) to recommend the best
          card per purchase—not a generic “best card” blog post.
        </p>
        <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
          <Link
            href="/register"
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Sign in
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            t: "Rules + offers",
            d: "Base earn rates and promos are evaluated together with explicit stack semantics.",
          },
          {
            t: "Merchant aware",
            d: "Known merchants and MCC reference data resolve spend categories before ranking.",
          },
          {
            t: "Explainable",
            d: "Every recommendation returns human-readable reasoning for trust and debugging.",
          },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 className="font-semibold">{x.t}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {x.d}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
