"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";

type Row = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  cardCount: number;
};

type ListRes = {
  items: Row[];
  total: number;
  page: number;
  pages: number;
};

export default function AdminUsersPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ id: string }>("/auth/me").then((m) => setMyId(m.id)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch<ListRes>(
        `/admin/users?page=${page}&limit=50`,
      );
      setData(res);
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(formatCaughtApiError(e));
      } else setErr("Erreur de chargement");
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    setErr(null);
    try {
      await apiFetch(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Échec de la mise à jour");
    } finally {
      setBusy(null);
    }
  };

  if (!data && !err) {
    return <Skeleton className="h-8 w-48" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Utilisateurs" />
      {err ? (
        <StatusMessage variant="error">
          <pre className="overflow-x-auto text-xs">{err}</pre>
        </StatusMessage>
      ) : null}

      <SurfaceCard className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Rôle</th>
              <th className="px-3 py-2 font-medium">Actif</th>
              <th className="px-3 py-2 font-medium">Cartes</th>
              <th className="px-3 py-2 font-medium">Créé</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id} className="border-b border-border/60">
                <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-3 py-2">
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                    {u.role}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {u.isActive ? (
                    <span className="text-primary">oui</span>
                  ) : (
                    <span className="text-destructive">non</span>
                  )}
                </td>
                <td className="px-3 py-2">{u.cardCount}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.isActive ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        disabled={busy === u.id}
                        onClick={() => patch(u.id, { isActive: false })}
                      >
                        Désactiver
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        disabled={busy === u.id}
                        onClick={() => patch(u.id, { isActive: true })}
                      >
                        Réactiver
                      </Button>
                    )}
                    {u.role !== "ADMIN" && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={busy === u.id}
                        onClick={() => patch(u.id, { role: "ADMIN" })}
                      >
                        Admin
                      </Button>
                    )}
                    {u.role === "ADMIN" && u.id !== myId && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="border-amber-500/40 text-amber-900 dark:text-amber-200"
                        disabled={busy === u.id}
                        onClick={() => patch(u.id, { role: "USER" })}
                      >
                        Retirer admin
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SurfaceCard>

      {data && data.pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </Button>
          <span>
            Page {data.page} / {data.pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}
