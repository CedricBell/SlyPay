import type { SpendCategory } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  Fuel,
  Package,
  Pill,
  Plane,
  ShoppingBag,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
} from "lucide-react";

export type CategoryUi = {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for list / chip surfaces */
  chipClass: string;
  iconClass: string;
  pinFrom: string;
  pinTo: string;
  pinStroke: string;
  /** 16×16 viewBox SVG markup for map pin center */
  pinIconSvg: string;
};

export const CATEGORY_UI: Record<SpendCategory, CategoryUi> = {
  GROCERIES: {
    label: "Groceries",
    icon: ShoppingBasket,
    chipClass: "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    pinFrom: "#059669",
    pinTo: "#34d399",
    pinStroke: "#047857",
    pinIconSvg: `<path d="M4 4h2l1.5 9h11L20 7H8" fill="none" stroke="#059669" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="17.5" r="1.25" fill="#059669"/><circle cx="16.5" cy="17.5" r="1.25" fill="#059669"/>`,
  },
  DINING: {
    label: "Restaurant",
    icon: UtensilsCrossed,
    chipClass: "bg-orange-500/12 text-orange-700 ring-1 ring-orange-500/20 dark:text-orange-300",
    iconClass: "text-orange-600 dark:text-orange-400",
    pinFrom: "#ea580c",
    pinTo: "#fb923c",
    pinStroke: "#c2410c",
    pinIconSvg: `<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3v5M17 8a3 3 0 0 1 6 0v10H11V8a3 3 0 0 1 6 0" fill="none" stroke="#ea580c" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  TRAVEL: {
    label: "Travel",
    icon: Plane,
    chipClass: "bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300",
    iconClass: "text-sky-600 dark:text-sky-400",
    pinFrom: "#0284c7",
    pinTo: "#38bdf8",
    pinStroke: "#0369a1",
    pinIconSvg: `<path d="M16 3l-8 8 4 2-3 5 2 1 3-5 4 2 8-8-4-2 3-5-2-1-3 5-4-2z" fill="none" stroke="#0284c7" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  GAS: {
    label: "Gas",
    icon: Fuel,
    chipClass: "bg-amber-500/12 text-amber-800 ring-1 ring-amber-500/20 dark:text-amber-300",
    iconClass: "text-amber-600 dark:text-amber-400",
    pinFrom: "#d97706",
    pinTo: "#fbbf24",
    pinStroke: "#b45309",
    pinIconSvg: `<path d="M4 18V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12M4 18h12M4 18v2h12v-2M14 8h2l2 4v4h-4V8z" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  ONLINE_SHOPPING: {
    label: "Shopping",
    icon: ShoppingBag,
    chipClass: "bg-violet-500/12 text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300",
    iconClass: "text-violet-600 dark:text-violet-400",
    pinFrom: "#7c3aed",
    pinTo: "#a78bfa",
    pinStroke: "#6d28d9",
    pinIconSvg: `<path d="M7 7V5a3 3 0 0 1 6 0v2M5 7h10l-1 11H6L5 7z" fill="none" stroke="#7c3aed" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  DRUGSTORES: {
    label: "Drugstore",
    icon: Pill,
    chipClass: "bg-rose-500/12 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300",
    iconClass: "text-rose-600 dark:text-rose-400",
    pinFrom: "#e11d48",
    pinTo: "#fb7185",
    pinStroke: "#be123c",
    pinIconSvg: `<path d="M10 2a4 4 0 0 0-2.8 6.8L10 12l2.8-3.2A4 4 0 0 0 10 2zm0 10l-6.8 6.8a4 4 0 1 0 5.6 5.6L10 17.2l1.2 1.2 6.8-6.8a4 4 0 1 0-5.6-5.6L10 12z" fill="none" stroke="#e11d48" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  ENTERTAINMENT: {
    label: "Entertainment",
    icon: Clapperboard,
    chipClass: "bg-fuchsia-500/12 text-fuchsia-700 ring-1 ring-fuchsia-500/20 dark:text-fuchsia-300",
    iconClass: "text-fuchsia-600 dark:text-fuchsia-400",
    pinFrom: "#c026d3",
    pinTo: "#e879f9",
    pinStroke: "#a21caf",
    pinIconSvg: `<path d="M3 5h14v10H3zM7 5v4M11 5v4M7 11v4M11 11v4" fill="none" stroke="#c026d3" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  WHOLESALE: {
    label: "Wholesale",
    icon: Package,
    chipClass: "bg-slate-500/12 text-slate-700 ring-1 ring-slate-500/20 dark:text-slate-300",
    iconClass: "text-slate-600 dark:text-slate-400",
    pinFrom: "#475569",
    pinTo: "#94a3b8",
    pinStroke: "#334155",
    pinIconSvg: `<path d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7" fill="none" stroke="#475569" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  OTHER: {
    label: "Other",
    icon: Store,
    chipClass: "bg-zinc-500/12 text-zinc-700 ring-1 ring-zinc-500/20 dark:text-zinc-300",
    iconClass: "text-zinc-600 dark:text-zinc-400",
    pinFrom: "#71717a",
    pinTo: "#a1a1aa",
    pinStroke: "#52525b",
    pinIconSvg: `<path d="M4 9V5l8-3 8 3v4M4 9h16v8H4V9zm4 0v8m8-8v8" fill="none" stroke="#71717a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
};

export const DEFAULT_CATEGORY_UI = CATEGORY_UI.OTHER;

export function getCategoryUi(category: SpendCategory | null | undefined): CategoryUi {
  if (!category) return DEFAULT_CATEGORY_UI;
  return CATEGORY_UI[category] ?? DEFAULT_CATEGORY_UI;
}

export function categoryLabelFromUi(category: SpendCategory | null | undefined): string {
  return getCategoryUi(category).label;
}

const pinCache = new Map<string, string>();

export function categoryMapPinUrl(
  category: SpendCategory | null | undefined,
  selected: boolean,
): string {
  const key = `${category ?? "none"}:${selected ? "1" : "0"}`;
  const cached = pinCache.get(key);
  if (cached) return cached;

  const ui = getCategoryUi(category);
  const w = selected ? 48 : 42;
  const h = selected ? 56 : 50;
  const stroke = selected ? "#6d28d9" : "#ffffff";
  const strokeW = selected ? 3.5 : 2.5;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 42 50">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ui.pinFrom}"/>
      <stop offset="100%" stop-color="${ui.pinTo}"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.28"/>
    </filter>
  </defs>
  <ellipse cx="21" cy="46" rx="9" ry="3" fill="#0f172a" opacity="0.14"/>
  <path filter="url(#s)" d="M21 3 C12.82 3 6 9.82 6 18 C6 28.5 21 44 21 44 C21 44 36 28.5 36 18 C36 9.82 29.18 3 21 3 Z" fill="url(#g)" stroke="${stroke}" stroke-width="${strokeW}"/>
  <circle cx="21" cy="18" r="10.5" fill="#ffffff" fill-opacity="0.97"/>
  <svg x="13" y="10" width="16" height="16" viewBox="0 0 20 20">${ui.pinIconSvg}</svg>
  ${selected ? `<circle cx="21" cy="18" r="13" fill="none" stroke="#6d28d9" stroke-width="1.5" stroke-opacity="0.45"/>` : ""}
</svg>`;

  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  pinCache.set(key, url);
  return url;
}

export function userLocationPinUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="12" fill="#2563eb" fill-opacity="0.18"/>
  <circle cx="14" cy="14" r="7" fill="#2563eb" stroke="#ffffff" stroke-width="3"/>
  <circle cx="14" cy="14" r="2.5" fill="#ffffff"/>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** Subtle map chrome — hides clutter, keeps roads & labels readable */
export const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "water",
    elementType: "geometry.fill",
    stylers: [{ color: "#dbeafe" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry.fill",
    stylers: [{ color: "#f4f4f5" }],
  },
];
