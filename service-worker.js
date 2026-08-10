/* =========================================================================
   service-worker.js — caches the app shell + workout database so the app
   keeps working with no network connection after the first visit.

   CACHE VERSIONING: bump CACHE_NAME (e.g. "wod-planner-v2") any time you
   change the file list below or want to force every client to fully
   re-download the app. The activate handler deletes any cache whose name
   doesn't match CACHE_NAME, so stale versions never stick around forever.
   ========================================================================= */

const CACHE_NAME = "wod-planner-v2";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./workouts.json",
  "./manifest.json",
  "./js/utils.js",
  "./js/storage.js",
  "./js/workoutData.js",
  "./js/planner.js",
  "./js/builder.js",
  "./js/ui-modals.js",
  "./js/ui-plan.js",
  "./js/ui-library.js",
  "./js/ui-progress.js",
  "./js/ui-settings.js",
  "./js/main.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate for same-origin GET requests: serve the cached
// copy instantly (so the app is fast and works offline), while quietly
// refreshing the cache from the network in the background when online.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never intercept external links (e.g. WODWell)

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
