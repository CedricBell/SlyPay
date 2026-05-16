"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";

type Product = {
  slug: string;
  name: string;
  issuer: string;
  lastExtractHash: string | null;
  officialDocumentUrl: string | null;
};

type CatalogProductRow = {
  slug: string;
  name: string;
  issuer: string;
  editorialSupplementUrls: string[];
};

type ProposalRow = {
  id: string;
  productSlug: string;
  previousHash: string | null;
  proposedHash: string;
  proposedPayload: unknown;
  createdAt: string;
  product: Product;
};

type ListRes = { items: ProposalRow[] };

export default function AdminCardCatalogPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [catRows, setCatRows] = useState<CatalogProductRow[] | null>(null);
  const [catErr, setCatErr] = useState<string | null>(null);
  const [catBusy, setCatBusy] = useState<string | null>(null);
  const [catDrafts, setCatDrafts] = useState<Record<string, string>>({});
  const [catFilter, setCatFilter] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch<ListRes>("/admin/card-catalog/proposals");
      setData(res);
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Erreur de chargement");
    }
  }, []);

  const loadCatalogProducts = useCallback(async () => {
    setCatErr(null);
    try {
      const res = await apiFetch<{ items: CatalogProductRow[] }>(
        "/admin/catalog-products",
      );
      setCatRows(res.items);
      const drafts: Record<string, string> = {};
      for (const r of res.items) {
        drafts[r.slug] = r.editorialSupplementUrls.join("\n");
      }
      setCatDrafts(drafts);
    } catch (e) {
      if (e instanceof ApiError) setCatErr(formatCaughtApiError(e));
      else setCatErr("Impossible de charger le catalogue");
    }
  }, []);

  useEffect(() => {
    void loadCatalogProducts();
  }, [loadCatalogProducts]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveEditorial = async (slug: string) => {
    setCatBusy(slug);
    setCatErr(null);
    try {
      const raw = catDrafts[slug] ?? "";
      const urls = raw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await apiFetch(`/admin/catalog-products/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        body: JSON.stringify({
          editorialSupplementUrls: urls.length ? urls : null,
        }),
      });
      await loadCatalogProducts();
    } catch (e) {
      if (e instanceof ApiError) setCatErr(formatCaughtApiError(e));
      else setCatErr("Enregistrement impossible");
    } finally {
      setCatBusy(null);
    }
  };

  const filteredCatRows = useMemo(() => {
    if (!catRows) return [];
    const q = catFilter.trim().toLowerCase();
    if (!q) return catRows;
    return catRows.filter(
      (r) =>
        r.slug.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.issuer.toLowerCase().includes(q),
    );
  }, [catRows, catFilter]);

  const apply = async (id: string) => {
    setBusy(id);
    setErr(null);
    try {
      await apiFetch(`/admin/card-catalog/proposals/${id}/apply`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Échec de l’application");
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (id: string) => {
    setBusy(id);
    setErr(null);
    try {
      await apiFetch(`/admin/card-catalog/proposals/${id}/dismiss`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Échec du refus");
    } finally {
      setBusy(null);
    }
  };

  if (!data && !err) {
    return <p className="text-sm text-zinc-500">Chargement…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Valide une extraction PDF pour figer le snapshot catalogue et mettre à jour les{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
            RewardRule
          </code>{" "}
          de toutes les cartes utilisateur liées au même slug catalogue.
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-600"
        >
          Rafraîchir
        </button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Sources éditoriales (complément d&apos;intel)
        </h3>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Une ou plusieurs URLs{" "}
          <strong>https</strong> sur{" "}
          <span className="font-mono">thepointsguy.com</span> ou{" "}
          <span className="font-mono">nerdwallet.com</span> /{" "}
          <span className="font-mono">creditcards.nerdwallet.com</span> (y compris{" "}
          <span className="font-mono">www.</span>). Le HTML est récupéré au moment du job
          d&apos;intel et concaténé <strong>après</strong> le document officiel pour
          l&apos;extraction LLM — en cas de conflit, le texte officiel prime. Respectez les
          conditions des sites tiers.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Filtrer par slug, nom ou émetteur…"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="min-w-[12rem] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={() => void loadCatalogProducts()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-600"
          >
            Recharger la liste
          </button>
        </div>
        {catErr && (
          <pre className="mt-2 overflow-x-auto rounded-lg bg-amber-50 p-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            {catErr}
          </pre>
        )}
        {catRows === null ? (
          <p className="mt-3 text-sm text-zinc-500">Chargement des produits catalogue…</p>
        ) : (
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[42rem] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th className="border-b border-zinc-200 p-2 font-semibold dark:border-zinc-800">
                    Slug
                  </th>
                  <th className="border-b border-zinc-200 p-2 font-semibold dark:border-zinc-800">
                    Carte
                  </th>
                  <th className="border-b border-zinc-200 p-2 font-semibold dark:border-zinc-800">
                    URLs (une par ligne, max 6)
                  </th>
                  <th className="border-b border-zinc-200 p-2 font-semibold dark:border-zinc-800">
                    {" "}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCatRows.map((r) => (
                  <tr
                    key={r.slug}
                    className="border-b border-zinc-100 odd:bg-white even:bg-zinc-50/80 dark:border-zinc-800 dark:odd:bg-zinc-950/40 dark:even:bg-zinc-900/30"
                  >
                    <td className="align-top p-2 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      {r.slug}
                    </td>
                    <td className="align-top p-2 text-zinc-800 dark:text-zinc-200">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-zinc-500">{r.issuer}</div>
                    </td>
                    <td className="p-2">
                      <textarea
                        rows={2}
                        value={catDrafts[r.slug] ?? ""}
                        onChange={(e) =>
                          setCatDrafts((m) => ({ ...m, [r.slug]: e.target.value }))
                        }
                        className="w-full resize-y rounded border border-zinc-200 bg-white p-2 font-mono text-[11px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        placeholder="https://www.nerdwallet.com/..."
                      />
                    </td>
                    <td className="align-top p-2">
                      <button
                        type="button"
                        disabled={catBusy === r.slug}
                        onClick={() => void saveEditorial(r.slug)}
                        className="rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
                      >
                        {catBusy === r.slug ? "…" : "Enregistrer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {err && (
        <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </pre>
      )}

      {!data?.items.length ? (
        <p className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Aucune proposition en attente. Une ligne apparaît ici seulement lorsque
          un <strong>nouveau</strong> PDF produit un extrait dont le hash{" "}
          <strong>diffère</strong> du snapshot déjà enregistré sur le produit
          catalogue. Au <strong>premier</strong> succès d&apos;intel, les règles
          sont appliquées automatiquement aux cartes liées — il n&apos;y a alors
          rien à valider ici. Ouvre la fiche carte : lien PDF, résumé extrait et
          règles synchronisées.
        </p>
      ) : (
        <div className="space-y-4">
          {data.items.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-zinc-200 bg-white/60 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {row.product.name}
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{row.product.issuer}</p>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    slug: {row.product.slug}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Proposé le {new Date(row.createdAt).toLocaleString()}
                  </p>
                  {row.product.officialDocumentUrl && (
                    <a
                      href={row.product.officialDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-violet-700 underline dark:text-violet-400"
                    >
                      Document PDF configuré
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => apply(row.id)}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {busy === row.id ? "…" : "Valider & synchroniser"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => dismiss(row.id)}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600"
                  >
                    Refuser
                  </button>
                </div>
              </div>

              <dl className="mt-4 grid gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-zinc-500">Hash précédent</dt>
                  <dd className="break-all font-mono">{row.previousHash ?? "— (premier état)"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-500">Hash proposé</dt>
                  <dd className="break-all font-mono">{row.proposedHash}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="mt-3 text-xs font-medium text-violet-700 dark:text-violet-400"
                onClick={() =>
                  setExpanded((m) => ({ ...m, [row.id]: !m[row.id] }))
                }
              >
                {expanded[row.id] ? "Masquer le JSON" : "Voir le JSON extrait"}
              </button>
              {expanded[row.id] && (
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-zinc-950 p-3 text-[11px] text-violet-100">
                  {JSON.stringify(row.proposedPayload, null, 2)}
                </pre>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-500">
        Variables d’environnement et commandes Prisma : fichier{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">frontend/.env.example</code>
        .
      </p>
    </div>
  );
}
