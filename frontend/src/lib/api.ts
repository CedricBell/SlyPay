import { API_BASE } from "./config";

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** Human-readable message; avoids dumping Next.js HTML error pages into the UI. */
export function formatApiErrorForUser(body: string, status: number): string {
  const raw = (body ?? "").trim();
  if (!raw) {
    return `Erreur HTTP ${status}`;
  }
  if (raw.startsWith("<!") || raw.startsWith("<html")) {
    return [
      `Le serveur a renvoyé une page d’erreur (${status}) au lieu de JSON.`,
      "Cause fréquente : cache `.next` corrompu ou mélange Turbopack / Webpack.",
      "Arrête le serveur, puis `cd frontend && npm run dev:clean` (efface `.next` une fois) ou `npm run dev` si le cache est déjà sain. Un seul terminal `next dev`.",
    ].join(" ");
  }
  try {
    const j = JSON.parse(raw) as { message?: unknown };
    if (typeof j?.message === "string" && j.message.trim()) {
      return j.message.trim();
    }
  } catch {
    /* not JSON */
  }
  const max = 800;
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

export function formatCaughtApiError(e: unknown): string {
  if (e instanceof ApiError) {
    return formatApiErrorForUser(e.body || e.message, e.status);
  }
  if (e instanceof Error) return e.message;
  return "Une erreur inattendue s’est produite.";
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { headers: h, ...rest } = init;
  const headers = new Headers(h);
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json");
  }

  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;

  const res = await fetch(url, {
    ...rest,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(res.status, text);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(res.status, text);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
