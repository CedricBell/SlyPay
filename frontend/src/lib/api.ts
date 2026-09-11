import { API_BASE } from "./config";

export { apiFetchCached, invalidateApiCache } from "./api-cache";

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
    return `HTTP error ${status}`;
  }
  if (raw.startsWith("<!") || raw.startsWith("<html")) {
    return [
      `The server returned an error page (${status}) instead of JSON.`,
      "Common cause: corrupt `.next` cache or mixing Turbopack / Webpack.",
      "Stop the server, then `cd frontend && npm run dev:clean` (clears `.next` once) or `npm run dev` if the cache is already healthy. Run a single `next dev` terminal.",
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

export type AuthApiErrorBody = {
  message: string;
  reason?: string;
  code?: string;
};

/** Parse JSON (or text) from a failed auth `fetch` response. */
export async function readAuthApiError(
  res: Response,
): Promise<AuthApiErrorBody> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as {
      message?: unknown;
      reason?: unknown;
      code?: unknown;
    };
    const message =
      typeof j?.message === "string" && j.message.trim()
        ? j.message.trim()
        : formatApiErrorForUser(text, res.status);
    return {
      message,
      reason: typeof j?.reason === "string" ? j.reason : undefined,
      code: typeof j?.code === "string" ? j.code : undefined,
    };
  } catch {
    return { message: formatApiErrorForUser(text, res.status) };
  }
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
