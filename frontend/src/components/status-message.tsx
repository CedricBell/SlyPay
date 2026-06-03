import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type StatusMessageProps = {
  variant?: "error" | "info" | "warning" | "success"
  title?: string
  children: React.ReactNode
  className?: string
}

const variantClass: Record<NonNullable<StatusMessageProps["variant"]>, string> =
  {
    error:
      "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/15",
    info: "border-border bg-muted/50 text-foreground",
    warning:
      "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
    success:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
  }

export function StatusMessage({
  variant = "info",
  title,
  children,
  className,
}: StatusMessageProps) {
  return (
    <Alert className={cn("rounded-2xl", variantClass[variant], className)}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription className="text-sm [&_pre]:overflow-x-auto">
        {children}
      </AlertDescription>
    </Alert>
  )
}
