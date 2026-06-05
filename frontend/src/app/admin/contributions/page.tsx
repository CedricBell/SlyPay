"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

type Row = {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  card: {
    id: string;
    name: string;
    issuer: string;
    catalogProductSlug: string | null;
  };
  userEmail: string;
};

type ListRes = {
  items: Row[];
  total: number;
  page: number;
  pages: number;
};

export default function AdminContributionsPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch<ListRes>(
        `/admin/contributions?status=${filter}&page=1`,
      );
      setData(res);
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Erreur de chargement");
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, status: "APPLIED" | "DISMISSED") => {
    setBusyId(id);
    try {
      await apiFetch(`/admin/contributions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Échec de la mise à jour");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Signalements clients"
        description="Notes « Missing something » sur les cartes du portefeuille. Marquez comme traité ou ignoré — relancez l’intel catalogue manuellement si besoin."
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant={filter === "PENDING" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("PENDING")}
        >
          En attente
        </Button>
        <Button
          type="button"
          variant={filter === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("ALL")}
        >
          Tous
        </Button>
      </div>
      {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
      <div className="space-y-3">
        {(data?.items ?? []).map((r) => (
          <SurfaceCard key={r.id} className="p-4 text-sm">
            <p className="font-medium">
              {r.card.name}{" "}
              <span className="text-muted-foreground">({r.card.issuer})</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {r.userEmail} · {new Date(r.createdAt).toLocaleString()} ·{" "}
              {r.status}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{r.body}</p>
            {r.status === "PENDING" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === r.id}
                  onClick={() => void review(r.id, "APPLIED")}
                >
                  Marquer traité
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === r.id}
                  onClick={() => void review(r.id, "DISMISSED")}
                >
                  Ignorer
                </Button>
              </div>
            ) : null}
          </SurfaceCard>
        ))}
      </div>
      {data && data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun signalement.</p>
      ) : null}
    </div>
  );
}
