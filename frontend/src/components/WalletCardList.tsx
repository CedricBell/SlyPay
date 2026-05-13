"use client";

import { CardThumbnail } from "@/components/CardThumbnail";

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
        className={`flex flex-row items-center gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99] ${
          active
            ? "border-violet-500/60 bg-violet-500/10 ring-2 ring-violet-500/25 shadow-sm dark:border-violet-500/40 dark:bg-violet-500/10"
            : "border-zinc-200/80 bg-white/50 hover:border-violet-300/50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-violet-900/40"
        }`}
          >
            <CardThumbnail
              name={c.name}
              issuer={c.issuer}
              last4={c.last4}
              colorHex={c.colorHex}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.name}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                {c.issuer}
                {c.last4 ? ` · •••• ${c.last4}` : ""}
              </span>
              {!c.isActive && (
                <span className="mt-1 block text-xs text-amber-600">Inactive</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
