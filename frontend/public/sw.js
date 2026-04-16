self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Minimal PWA service worker for installability.
// We keep fetch passthrough to avoid stale API responses.
self.addEventListener("fetch", () => {});

