/** Decorative card image from accent color + last4 (no external assets). */

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const n = hex.trim().replace("#", "");
  if (n.length !== 6) return null;
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

function shadeHex(hex: string, factor: number): string {
  const p = parseHex(hex);
  if (!p) return "#0f172a";
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `rgb(${clamp(p.r * factor)}, ${clamp(p.g * factor)}, ${clamp(p.b * factor)})`;
}

function ContactlessIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8.5 14.5c2-3 5-3 7 0M7 11c3.5-5 8.5-5 12 0M5.5 8.5c4.5-7 13.5-7 18 0" />
    </svg>
  );
}

export type CardThumbnailSize = "xs" | "sm" | "md" | "lg";

const SIZE_DIMS: Record<
  CardThumbnailSize,
  { box: string; chip: string; waves: string; label: string; mono: string }
> = {
  xs: {
    box: "h-[34px] w-[54px] rounded-[6px]",
    chip: "h-[10px] w-[13px] rounded-[2px]",
    waves: "h-3 w-3",
    label: "text-[6px] leading-tight",
    mono: "text-[7px] tracking-tighter",
  },
  sm: {
    box: "h-[42px] w-[67px] rounded-lg",
    chip: "h-[12px] w-[16px] rounded-[3px]",
    waves: "h-3.5 w-3.5",
    label: "text-[7px] leading-tight",
    mono: "text-[8px] tracking-tight",
  },
  md: {
    box: "h-[68px] w-[108px] rounded-xl",
    chip: "h-[18px] w-[24px] rounded-md",
    waves: "h-5 w-5",
    label: "text-[9px] leading-snug",
    mono: "text-[11px] tracking-wide",
  },
  lg: {
    box: "h-[108px] w-[172px] rounded-2xl",
    chip: "h-7 w-9 rounded-md",
    waves: "h-8 w-8",
    label: "text-[11px] leading-snug",
    mono: "text-sm tracking-widest",
  },
};

type Props = {
  name?: string;
  issuer?: string;
  last4?: string | null;
  colorHex?: string | null;
  size?: CardThumbnailSize;
  className?: string;
  /** Emphasize on colored backgrounds */
  highlight?: boolean;
};

export function CardThumbnail({
  name,
  issuer,
  last4,
  colorHex,
  size = "sm",
  className = "",
  highlight = false,
}: Props) {
  const base = colorHex?.trim() || "#0f172a";
  const c1 = base;
  const c2 = shadeHex(base, 0.45);
  const d = SIZE_DIMS[size];
  const label = (issuer || name || "").trim();
  const showLabel = size !== "xs" && label.length > 0;

  return (
    <div
      className={`relative shrink-0 overflow-hidden shadow-lg ring-1 ring-black/10 ${d.box} ${highlight ? "ring-2 ring-white/40" : ""} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
      }}
      aria-hidden={!last4}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.22),transparent_55%)]" />
      <div className="relative flex h-full flex-col p-[8%]">
        <div className="flex items-start justify-between gap-1">
          <div
            className={`bg-gradient-to-br from-amber-100 to-amber-400/90 shadow-inner ${d.chip}`}
          />
          <ContactlessIcon className={`text-white/85 ${d.waves}`} />
        </div>
        <div className="mt-auto space-y-0.5">
          {showLabel ? (
            <p
              className={`truncate font-medium text-white/90 ${d.label}`}
              title={label}
            >
              {issuer ? issuer : name}
            </p>
          ) : null}
          <p
            className={`text-right font-mono font-semibold leading-none text-white ${d.mono}`}
          >
            {last4 ? `•••• ${last4}` : "••••"}
          </p>
        </div>
      </div>
    </div>
  );
}
