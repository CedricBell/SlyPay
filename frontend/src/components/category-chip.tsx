import type { SpendCategory } from "@prisma/client";
import { cn } from "@/lib/utils";
import { categoryLabelFromUi, getCategoryUi } from "@/lib/spend-category-ui";

type Props = {
  category: SpendCategory | null | undefined;
  className?: string;
};

export function CategoryChip({ category, className }: Props) {
  const ui = getCategoryUi(category);
  const Icon = ui.icon;
  const label = categoryLabelFromUi(category);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        ui.chipClass,
        className,
      )}
    >
      <Icon className={cn("size-3 shrink-0", ui.iconClass)} strokeWidth={2.25} />
      {label}
    </span>
  );
}
