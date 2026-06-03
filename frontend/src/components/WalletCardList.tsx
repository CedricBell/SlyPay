"use client";

import { CardThumbnail } from "@/components/CardThumbnail";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      <p className="text-sm text-muted-foreground">
        No cards yet. Add one to personalize recommendations.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cards.map((c) => {
        const active = selectedId === c.id;
        return (
          <Button
            key={c.id}
            type="button"
            variant="outline"
            onClick={() => onSelect(active ? null : c.id)}
            className={cn(
              "h-auto flex-row items-center justify-start gap-3 rounded-2xl px-3 py-3 text-left",
              active &&
                "border-violet-500/60 bg-violet-500/10 ring-2 ring-violet-500/25 dark:border-violet-500/40",
            )}
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
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {c.issuer}
                {c.last4 ? ` · •••• ${c.last4}` : ""}
              </span>
              {!c.isActive && (
                <span className="mt-1 block text-xs text-amber-600">
                  Inactive
                </span>
              )}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
