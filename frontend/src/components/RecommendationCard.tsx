type Ranked = {
  cardId: string;
  cardName: string;
  issuer: string;
  comparableValue: number;
  effectiveMultiplier: number;
  earningType: string;
};

type Props = {
  amount: number;
  resolvedCategory: string;
  bestCard: { name: string; issuer: string; last4: string | null } | null;
  reasoning: string[];
  ranked: Ranked[];
  alternatesTied: string[];
  trace: string[];
  marketBest: {
    cardId: string;
    cardName: string;
    issuer: string;
    comparableValue: number;
    effectiveMultiplier: number;
    earningType: string;
    deltaVsWalletBest: number;
  } | null;
};

export function RecommendationCard({
  amount,
  resolvedCategory,
  bestCard,
  reasoning,
  ranked,
  alternatesTied,
  trace,
  marketBest,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">
          Best card for this purchase
        </p>
        <h2 className="mt-1 text-2xl font-semibold">
          {bestCard ? bestCard.name : "Add a card to get recommendations"}
        </h2>
        {bestCard && (
          <p className="text-sm text-emerald-100">
            {bestCard.issuer}
            {bestCard.last4 ? ` · ending ${bestCard.last4}` : ""}
          </p>
        )}
      </div>
      <div className="space-y-4 px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Context
          </p>
          <p>
            ${amount.toFixed(2)} · resolved category{" "}
            <span className="font-mono text-xs">{resolvedCategory}</span>
          </p>
        </div>
        {alternatesTied.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Tie detected: multiple cards score the same. Showing deterministic
            winner; see ranking below.
          </p>
        )}
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Why this card
          </p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {trace.map((t, i) => (
              <li key={`t-${i}`}>{t}</li>
            ))}
            {reasoning.map((t, i) => (
              <li key={`r-${i}`}>{t}</li>
            ))}
          </ul>
        </div>
        {marketBest && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 dark:border-sky-900 dark:bg-sky-950/30">
            <p className="text-xs font-semibold uppercase text-sky-800 dark:text-sky-200">
              Global catalog comparison
            </p>
            <p className="mt-1">
              Best known catalog card for this spend:{" "}
              <span className="font-semibold">
                {marketBest.cardName} ({marketBest.issuer})
              </span>
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {marketBest.effectiveMultiplier}x · score{" "}
              {marketBest.comparableValue.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Gap vs your best wallet card:{" "}
              <span className="font-medium">
                {marketBest.deltaVsWalletBest >= 0 ? "+" : ""}
                {marketBest.deltaVsWalletBest.toFixed(2)}
              </span>
            </p>
          </div>
        )}
        {ranked.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              All cards (ranked)
            </p>
            <ol className="mt-2 space-y-2">
              {ranked.map((r, idx) => (
                <li
                  key={r.cardId}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                >
                  <span>
                    <span className="text-zinc-400">{idx + 1}. </span>
                    {r.cardName}{" "}
                    <span className="text-zinc-500">({r.issuer})</span>
                  </span>
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {r.effectiveMultiplier}x · score {r.comparableValue.toFixed(2)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
