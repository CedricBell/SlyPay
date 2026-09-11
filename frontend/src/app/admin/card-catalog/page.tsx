"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, apiUpload, ApiError, formatCaughtApiError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Textarea } from "@/components/ui/textarea";

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
  officialDocumentUrl: string | null;
  hasCatalogExtract: boolean;
  catalogLastFetchedAt: string | null;
  uploadedDocument: {
    byteSize: number;
    fileName: string | null;
    uploadedAt: string;
  } | null;
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
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [catDrafts, setCatDrafts] = useState<Record<string, string>>({});
  const [catFilter, setCatFilter] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch<ListRes>("/admin/card-catalog/proposals");
      setData(res);
    } catch (e) {
      if (e instanceof ApiError) setErr(formatCaughtApiError(e));
      else setErr("Failed to load");
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
      else setCatErr("Failed to load catalog");
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
      else setCatErr("Save failed");
    } finally {
      setCatBusy(null);
    }
  };

  const uploadPdf = async (slug: string, file: File) => {
    setPdfBusy(slug);
    setCatErr(null);
    try {
      const fd = new FormData();
      fd.append("document", file);
      await apiUpload(
        `/admin/catalog-products/${encodeURIComponent(slug)}/document`,
        fd,
      );
      await loadCatalogProducts();
    } catch (e) {
      if (e instanceof ApiError) setCatErr(formatCaughtApiError(e));
      else setCatErr("PDF upload failed");
    } finally {
      setPdfBusy(null);
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
      else setErr("Apply failed");
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
      else setErr("Dismiss failed");
    } finally {
      setBusy(null);
    }
  };

  if (!data && !err) {
    return <Skeleton className="h-8 w-48" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Catalog intel" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Approve a PDF extraction to lock the catalog snapshot and update the{" "}
          <code className="rounded bg-muted/50 px-1 py-0.5 text-xs dark:bg-card">
            RewardRule
          </code>{" "}
          rows for the catalog product (shared by all user instances).
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => load()}>
          Refresh
        </Button>
      </div>

      <SurfaceCard className="p-4">
        <h3 className="text-sm font-semibold text-foreground dark:text-foreground">
          Official PDF & editorial sources
        </h3>
        <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
          Upload the rewards/terms PDF per product — LLM intel starts
          automatically. Cards added later reuse the extract without re-running
          analysis. Editorial URLs (TPG, NerdWallet) are optional and appended
          after the official PDF.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder="Filter by slug, name, or issuer…"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className={`${inputClassName} min-w-48 flex-1`}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadCatalogProducts()}
          >
            Reload list
          </Button>
        </div>
        {catErr ? (
          <StatusMessage variant="warning" className="mt-2">
            <pre className="overflow-x-auto text-xs">{catErr}</pre>
          </StatusMessage>
        ) : null}
        {catRows === null ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading catalog products…</p>
        ) : (
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-border dark:border-border">
            <table className="w-full min-w-[56rem] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-muted/50 dark:bg-card">
                <tr>
                  <th className="border-b border-border p-2 font-semibold dark:border-border">
                    Slug
                  </th>
                  <th className="border-b border-border p-2 font-semibold dark:border-border">
                    Card
                  </th>
                  <th className="border-b border-border p-2 font-semibold dark:border-border">
                    Admin PDF
                  </th>
                  <th className="border-b border-border p-2 font-semibold dark:border-border">
                    Editorial URLs
                  </th>
                  <th className="border-b border-border p-2 font-semibold dark:border-border">
                    {" "}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCatRows.map((r) => (
                  <tr
                    key={r.slug}
                    className="border-b border-border odd:bg-white even:bg-muted/40/80 dark:border-border dark:odd:bg-card/40 dark:even:bg-card/30"
                  >
                    <td className="align-top p-2 font-mono text-[11px] text-muted-foreground dark:text-muted-foreground">
                      {r.slug}
                    </td>
                    <td className="align-top p-2 text-foreground dark:text-foreground">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-muted-foreground">{r.issuer}</div>
                      {r.hasCatalogExtract ? (
                        <span className="mt-1 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Extract OK
                        </span>
                      ) : (
                        <span className="mt-1 inline-block text-[10px] text-muted-foreground">
                          No extract
                        </span>
                      )}
                    </td>
                    <td className="align-top p-2">
                      {r.uploadedDocument ? (
                        <p className="text-[10px] text-muted-foreground">
                          {r.uploadedDocument.fileName ?? "PDF"} ·{" "}
                          {Math.round(r.uploadedDocument.byteSize / 1024)} KB
                        </p>
                      ) : null}
                      {r.officialDocumentUrl ? (
                        <a
                          href={r.officialDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-[10px] font-medium text-violet-700 underline dark:text-violet-400"
                        >
                          View document
                        </a>
                      ) : null}
                      <label className="mt-2 flex cursor-pointer flex-col gap-1">
                        <span className="text-[10px] font-medium text-foreground">
                          {pdfBusy === r.slug ? "Uploading…" : "Choose PDF"}
                        </span>
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          disabled={pdfBusy === r.slug}
                          className="max-w-[11rem] text-[10px] file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-[10px] file:font-medium file:text-white"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadPdf(r.slug, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </td>
                    <td className="p-2">
                      <Textarea
                        rows={2}
                        value={catDrafts[r.slug] ?? ""}
                        onChange={(e) =>
                          setCatDrafts((m) => ({ ...m, [r.slug]: e.target.value }))
                        }
                        className="font-mono text-[11px]"
                        placeholder="https://www.nerdwallet.com/..."
                      />
                    </td>
                    <td className="align-top p-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={catBusy === r.slug}
                        onClick={() => void saveEditorial(r.slug)}
                      >
                        {catBusy === r.slug ? "…" : "URLs"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {err ? (
        <StatusMessage variant="error">
          <pre className="overflow-x-auto text-xs">{err}</pre>
        </StatusMessage>
      ) : null}

      {!data?.items.length ? (
        <SurfaceCard className="p-6 text-sm text-muted-foreground">
          No pending proposals. A row appears here only when a{" "}
          <strong>new</strong> PDF produces an extract whose hash{" "}
          <strong>differs</strong> from the snapshot already stored on the catalog
          product. On the <strong>first</strong> successful intel run, rules are
          applied automatically to linked cards — there is nothing to approve
          here in that case. Open the card detail page for the PDF link, extract
          summary, and synced rules.
        </SurfaceCard>
      ) : (
        <div className="space-y-4">
          {data.items.map((row) => (
            <SurfaceCard key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground dark:text-foreground">
                    {row.product.name}
                  </h2>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">{row.product.issuer}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    slug: {row.product.slug}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Proposed on {new Date(row.createdAt).toLocaleString()}
                  </p>
                  {row.product.officialDocumentUrl && (
                    <a
                      href={row.product.officialDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-violet-700 underline dark:text-violet-400"
                    >
                      Configured PDF document
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => apply(row.id)}
                  >
                    {busy === row.id ? "…" : "Apply & sync"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy === row.id}
                    onClick={() => dismiss(row.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>

              <dl className="mt-4 grid gap-2 text-xs text-muted-foreground dark:text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-muted-foreground">Previous hash</dt>
                  <dd className="break-all font-mono">{row.previousHash ?? "— (first state)"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Proposed hash</dt>
                  <dd className="break-all font-mono">{row.proposedHash}</dd>
                </div>
              </dl>

              <Button
                type="button"
                variant="link"
                className="mt-3 h-auto p-0 text-xs"
                onClick={() =>
                  setExpanded((m) => ({ ...m, [row.id]: !m[row.id] }))
                }
              >
                {expanded[row.id] ? "Hide JSON" : "View extracted JSON"}
              </Button>
              {expanded[row.id] && (
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-card p-3 text-[11px] text-violet-100">
                  {JSON.stringify(row.proposedPayload, null, 2)}
                </pre>
              )}
            </SurfaceCard>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Environment variables and Prisma commands: see{" "}
        <code className="rounded bg-muted/50 px-1 dark:bg-card">frontend/.env.example</code>
        .
      </p>
    </div>
  );
}
