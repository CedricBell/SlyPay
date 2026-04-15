/** API interne Next (B-lite). Surcharge avec NEXT_PUBLIC_API_URL si tu réutilises un backend Nest. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1";
