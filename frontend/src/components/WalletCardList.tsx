type CardRow = {
  id: string;
  name: string;
  issuer: string;
  last4: string | null;
  colorHex: string | null;
  isActive: boolean;
};

type Props = {
  cards: CardRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function WalletCardList({ cards, selectedId, onSelect }: Props) {
  if (!cards.length) {
    return (
      <p className="text-sm text-zinc-500">
        No cards yet. Add one to personalize recommendations.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cards.map((c) => {
        const active = selectedId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(active ? null : c.id)}
            className={`flex flex-col rounded-xl border px-3 py-3 text-left transition ${
              active
                ? "border-emerald-600 ring-2 ring-emerald-500/30"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
            }`}
            style={{
              borderLeftWidth: 4,
              borderLeftColor: c.colorHex ?? "#0f172a",
            }}
          >
            <span className="font-medium">{c.name}</span>
            <span className="text-xs text-zinc-500">
              {c.issuer}
              {c.last4 ? ` · •••• ${c.last4}` : ""}
            </span>
            {!c.isActive && (
              <span className="mt-1 text-xs text-amber-600">Inactive</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
