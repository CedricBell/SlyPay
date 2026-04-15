"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

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
        setErr(e.body || e.message);
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
      if (e instanceof ApiError) setErr(e.body || e.message);
      else setErr("Échec de la mise à jour");
    } finally {
      setBusy(null);
    }
  };

  if (!data && !err) {
    return <p className="text-sm text-zinc-500">Chargement…</p>;
  }

  return (
    <div className="space-y-4">
      {err && (
        <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </pre>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
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
              <tr
                key={u.id}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">
                  {u.isActive ? (
                    <span className="text-emerald-600">oui</span>
                  ) : (
                    <span className="text-red-600">non</span>
                  )}
                </td>
                <td className="px-3 py-2">{u.cardCount}</td>
                <td className="px-3 py-2 text-xs text-zinc-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.isActive ? (
                      <button
                        type="button"
                        disabled={busy === u.id}
                        className="rounded bg-zinc-200 px-2 py-1 text-xs hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                        onClick={() => patch(u.id, { isActive: false })}
                      >
                        Désactiver
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === u.id}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                        onClick={() => patch(u.id, { isActive: true })}
                      >
                        Réactiver
                      </button>
                    )}
                    {u.role !== "ADMIN" && (
                      <button
                        type="button"
                        disabled={busy === u.id}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                        onClick={() => patch(u.id, { role: "ADMIN" })}
                      >
                        Admin
                      </button>
                    )}
                    {u.role === "ADMIN" && u.id !== myId && (
                      <button
                        type="button"
                        disabled={busy === u.id}
                        className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:text-amber-200"
                        onClick={() => patch(u.id, { role: "USER" })}
                      >
                        Retirer admin
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </button>
          <span>
            Page {data.page} / {data.pages}
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
