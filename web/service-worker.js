const CACHE_NAME = "driveos-shell-5.2.5";
const OFFLINE_URL = "/offline.html";

const SHELL = [
  OFFLINE_URL,
  "/assets/driveos-logo-v3.png",
  "/assets/favicon.png",
  "/assets/dashboard-model3-rear-hd.png",
  "/assets/pwa-180.png",
  "/assets/pwa-192.png",
  "/assets/pwa-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // CSS/JS/build metadata are always network-only so UI updates cannot be
  // hidden by an old PWA shell cache.
  if (
    url.pathname === "/styles.css" ||
    url.pathname.endsWith(".js") ||
    url.pathname === "/build.json" ||
    url.pathname === "/service-worker.js"
  ) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  event.respondWith(
    fetch(request, { cache: "no-store" })
      .catch(() => caches.match(request))
  );
});
