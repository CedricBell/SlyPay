import type { SpendCategory } from "@prisma/client";
import { cn } from "@/lib/utils";
import { getCategoryUi } from "@/lib/spend-category-ui";

const SIZE = {
  sm: { box: "size-8 rounded-lg", icon: "size-3.5" },
  md: { box: "size-10 rounded-xl", icon: "size-4.5" },
  lg: { box: "size-12 rounded-2xl", icon: "size-5" },
} as const;

type Props = {
  category: SpendCategory | null | undefined;
  size?: keyof typeof SIZE;
  className?: string;
  selected?: boolean;
};

export function SpendCategoryIcon({
  category,
  size = "md",
  className,
  selected,
}: Props) {
  const ui = getCategoryUi(category);
  const Icon = ui.icon;
  const s = SIZE[size];

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center transition-colors",
        s.box,
        selected
          ? cn(ui.chipClass, "ring-2 ring-primary/30")
          : cn(ui.chipClass),
        className,
      )}
    >
      <Icon className={cn(s.icon, ui.iconClass)} strokeWidth={2.25} />
    </span>
  );
}
