/** Internal Next API (B-lite). Override with NEXT_PUBLIC_API_URL to point at a Nest backend. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1";
