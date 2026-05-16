"use client";

import Image from "next/image";
import type { CatalogTemplate } from "@/components/CardCatalogSuggest";

type Props = {
  template: CatalogTemplate;
  accentColor: string;
};

export function SelectedCatalogCard({ template, accentColor }: Props) {
  return (
    <div className="motion-enter overflow-hidden rounded-2xl border border-violet-200/80 bg-white shadow-sm dark:border-violet-900/50 dark:bg-zinc-950/60">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        {template.imageUrl ? (
          <Image
            src={template.imageUrl}
            alt={`${template.issuer} ${template.name}`}
            width={320}
            height={200}
            className="h-28 w-full rounded-xl border border-zinc-200 object-cover sm:h-24 sm:w-44 dark:border-zinc-800"
            unoptimized
          />
        ) : (
          <div
            className="h-28 w-full rounded-xl border border-zinc-200 sm:h-24 sm:w-44 dark:border-zinc-800"
            style={{ backgroundColor: accentColor }}
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {template.intelAdHocFromName ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                Issuer site
              </span>
            ) : (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900 dark:bg-violet-900/40 dark:text-violet-200">
                Catalogue
              </span>
            )}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              {template.id}
            </code>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {template.name}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{template.issuer}</p>
        </div>
      </div>

      <div className="border-t border-violet-100/80 bg-violet-50/40 px-5 py-4 dark:border-violet-900/40 dark:bg-violet-950/20">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/15"
            aria-hidden
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent dark:border-violet-400" />
          </span>
          <div>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
              Analyzing rewards
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              After you save, we fetch official terms from the issuer site and
              extract earn rates. Your score and rules will appear once analysis
              finishes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
