import { apiFetch } from "@/lib/api";

type CacheEntry = { data: unknown; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export function invalidateApiCache(pathPrefix?: string) {
  for (const key of cache.keys()) {
    if (!pathPrefix || key.startsWith(pathPrefix)) cache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (!pathPrefix || key.startsWith(pathPrefix)) inflight.delete(key);
  }
}

/** GET with in-memory TTL + in-flight deduplication (fewer round-trips on tab switches). */
export async function apiFetchCached<T>(
  path: string,
  options?: { ttlMs?: number; force?: boolean },
): Promise<T> {
  const ttlMs = options?.ttlMs ?? 30_000;
  const key = path;
  const now = Date.now();

  if (!options?.force) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) return hit.data as T;
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const request = apiFetch<T>(path)
    .then((data) => {
      cache.set(key, { data, expiresAt: Date.now() + ttlMs });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, request);
  return request;
}
