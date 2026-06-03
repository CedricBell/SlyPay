"use client";

import Image from "next/image";
import type { CatalogTemplate } from "@/components/CardCatalogSuggest";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";

type Props = {
  template: CatalogTemplate;
  accentColor: string;
};

export function SelectedCatalogCard({ template, accentColor }: Props) {
  return (
    <SurfaceCard className="motion-enter overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        {template.imageUrl ? (
          <Image
            src={template.imageUrl}
            alt={`${template.issuer} ${template.name}`}
            width={320}
            height={200}
            className="h-28 w-full rounded-xl border border-border object-cover sm:h-24 sm:w-44"
            unoptimized
          />
        ) : (
          <div
            className="h-28 w-full rounded-xl border border-border sm:h-24 sm:w-44"
            style={{ backgroundColor: accentColor }}
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {template.intelAdHocFromName ? (
              <Badge className="bg-emerald-500/15 text-emerald-900 dark:text-emerald-100">
                Issuer site
              </Badge>
            ) : (
              <Badge className="bg-primary/15 text-primary">Catalogue</Badge>
            )}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {template.id}
            </code>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">{template.name}</h2>
          <p className="text-sm text-muted-foreground">{template.issuer}</p>
        </div>
      </div>

      <div className="border-t border-primary/15 bg-primary/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15"
            aria-hidden
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </span>
          <div>
            <p className="text-sm font-medium">Rewards pipeline queued</p>
            <p className="text-xs text-muted-foreground">
              After save, we fetch official issuer terms and map reward rules
              automatically.
            </p>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
