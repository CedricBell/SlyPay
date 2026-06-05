"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CardThumbnail } from "@/components/CardThumbnail";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { apiFetch, ApiError } from "@/lib/api";
import { inputClassName } from "@/components/ui/field";

type CatalogHit = {
  id: string;
  name: string;
  issuer: string;
  imageUrl?: string | null;
  colorHex?: string;
};

const ISSUER_FILTERS = [
  "All",
  "Chase",
  "American Express",
  "Citi",
  "Capital One",
  "Discover",
  "Wells Fargo",
  "Bank of America",
  "U.S. Bank",
  "Synchrony",
] as const;

export default function CatalogBrowsePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [issuer, setIssuer] = useState<string>("All");
  const [items, setItems] = useState<CatalogHit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<CatalogHit[]>(
          `/cards/catalog/suggestions?q=${encodeURIComponent(q)}&limit=200`,
        );
        setItems(data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setItems([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, router]);

  const filtered = useMemo(() => {
    if (issuer === "All") return items;
    return items.filter(
      (c) => c.issuer.toLowerCase() === issuer.toLowerCase(),
    );
  }, [items, issuer]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Card catalog"
        description="Browse supported products. Add any card to your wallet — rewards are filled automatically from official documentation."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          className={inputClassName}
          placeholder="Search by name or issuer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {ISSUER_FILTERS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setIssuer(label)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                issuer === label
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading catalog…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <SurfaceCard key={c.id} className="p-4">
              <div className="flex items-start gap-3">
                <CardThumbnail
                  name={c.name}
                  issuer={c.issuer}
                  imageUrl={c.imageUrl}
                  colorHex={c.colorHex}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.issuer}</p>
                  <Link
                    href={`/cards/new?catalog=${encodeURIComponent(c.id)}`}
                    className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                  >
                    Add to wallet
                  </Link>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cards match your filters.</p>
      ) : null}
    </div>
  );
}
