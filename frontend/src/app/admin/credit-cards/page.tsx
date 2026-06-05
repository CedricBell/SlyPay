"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError, formatCaughtApiError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";

type IntelJob = {
  status: string;
  createdAt: string;
  finishedAt: string | null;
  errorSnippet: string | null;
};

type Row = {
  slug: string;
  name: string;
  issuer: string;
  walletInstanceCount: number;
  officialDocumentUrl: string | null;
  hasCatalogExtract: boolean;
  catalogLastFetchedAt: string | null;
  rewardRuleCount: number;
  rulePreview: string[];
  latestIntelJob: IntelJob | null;
  updatedAt: string;
};

type ListRes = {
  items: Row[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

function jobStatusClass(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "text-emerald-700 dark:text-emerald-400";
    case "FAILED":
      return "text-red-700 dark:text-red-400";
    case "RUNNING":
    case "PENDING":
      return "text-amber-700 dark:text-amber-400";
    case "SKIPPED_NO_SOURCE":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

export default function AdminCreditCardsPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [refreshingSlug, setRefreshingSlug] = useState<string | null>(null);
  const [refreshingImageSlug, setRefreshingImageSlug] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch<ListRes>(
        `/admin/credit-cards?page=${page}&limit=50`,
      );
      setData(res);
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Erreur de chargement");
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshIntel = async (slug: string) => {
    setRefreshingSlug(slug);
    setErr(null);
    try {
      await apiFetch(`/admin/catalog/${encodeURIComponent(slug)}/refresh-intel`, {
        method: "POST",
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Échec du relancement intel");
    } finally {
      setRefreshingSlug(null);
    }
  };

  const refreshImage = async (slug: string) => {
    setRefreshingImageSlug(slug);
    setErr(null);
    try {
      await apiFetch(`/admin/catalog/${encodeURIComponent(slug)}/refresh-image`, {
        method: "POST",
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Échec du téléchargement de l'image");
    } finally {
      setRefreshingImageSlug(null);
    }
  };

  if (!data && !err) {
    return <Skeleton className="h-8 w-56" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Catalogue cartes (produits)" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? "—"} produit(s) catalogue — règles et PDF partagés par
          tous les exemplaires en portefeuille. Édition réservée aux admins via{" "}
          <Link href="/admin/card-catalog" className="font-medium text-primary underline">
            Intel catalogue
          </Link>
          .
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Rafraîchir
        </Button>
      </div>

      {err ? (
        <StatusMessage variant="error">
          <pre className="overflow-x-auto text-xs">{err}</pre>
        </StatusMessage>
      ) : null}

      <SurfaceCard className="overflow-x-auto p-0">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Produit catalogue</th>
              <th className="px-3 py-2 font-medium">Exemplaires</th>
              <th className="px-3 py-2 font-medium">Extrait PDF</th>
              <th className="px-3 py-2 font-medium">Règles</th>
              <th className="px-3 py-2 font-medium">Job intel</th>
              <th className="px-3 py-2 font-medium">Màj</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((r) => (
              <tr key={r.slug} className="border-b border-border/60 align-top">
                <td className="px-3 py-2">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.issuer}</p>
                  <code className="mt-1 inline-block rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px]">
                    {r.slug}
                  </code>
                </td>
                <td className="px-3 py-2 text-xs">
                  <span className="font-semibold">{r.walletInstanceCount}</span>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    portefeuilles utilisateur
                  </p>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.hasCatalogExtract ? (
                    <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Extrait OK
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Pas d&apos;extrait</span>
                  )}
                  {r.officialDocumentUrl ? (
                    <a
                      href={r.officialDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-[10px] font-medium text-violet-700 underline dark:text-violet-400"
                    >
                      Document
                    </a>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs">
                  <span className="font-semibold">{r.rewardRuleCount}</span>
                  {r.rulePreview.length > 0 && (
                    <ul className="mt-1 max-w-[220px] space-y-0.5 text-[11px] text-muted-foreground">
                      {r.rulePreview.map((line, idx) => (
                        <li key={`${r.slug}-r${idx}`} className="truncate" title={line}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.latestIntelJob ? (
                    <>
                      <span
                        className={`font-semibold ${jobStatusClass(r.latestIntelJob.status)}`}
                      >
                        {r.latestIntelJob.status}
                      </span>
                      {r.latestIntelJob.errorSnippet && (
                        <p className="mt-1 max-w-[200px] text-[10px] text-red-600 dark:text-red-400">
                          {r.latestIntelJob.errorSnippet}…
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-[11px] text-muted-foreground">
                  {new Date(r.updatedAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        refreshingSlug === r.slug ||
                        refreshingImageSlug === r.slug
                      }
                      onClick={() => void refreshIntel(r.slug)}
                    >
                      {refreshingSlug === r.slug ? "…" : "Intel"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        refreshingSlug === r.slug ||
                        refreshingImageSlug === r.slug
                      }
                      onClick={() => void refreshImage(r.slug)}
                    >
                      {refreshingImageSlug === r.slug ? "…" : "Image"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SurfaceCard>

      {data && data.pages > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </Button>
          <span className="text-muted-foreground">
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
