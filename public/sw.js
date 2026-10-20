/* SmartCRM Scanner service worker — Android "Share to SmartCRM" only. No offline caching. */
const SHARE_CACHE = "smartcrm-share-target";
const SHARE_CACHE_KEY = "/shared-file";
const SHARE_PATH = "/crm/intake/share";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== SHARE_PATH) return;

  event.respondWith(
    (async () => {
      try {
        const form = await request.formData();
        const file = form.get("file");
        if (file instanceof File && file.size > 0) {
          const cache = await caches.open(SHARE_CACHE);
          await cache.put(
            SHARE_CACHE_KEY,
            new Response(file, {
              headers: {
                "content-type": file.type || "application/octet-stream",
                "x-file-name": encodeURIComponent(file.name || "shared-card"),
              },
            }),
          );
        }
      } catch {
        /* fall through to the intake page, which shows the idle state */
      }
      return Response.redirect("/crm/intake?shared=1", 303);
    })(),
  );
});
