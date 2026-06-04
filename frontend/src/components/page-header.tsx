import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function PageHeader({
  eyebrow,
  title,
  description,
  className,
  children,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </div>
      ) : null}
      {children}
    </div>
  )
}
