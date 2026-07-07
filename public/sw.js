const STATIC_CACHE = "buro-finans-static-v6";
const RUNTIME_CACHE = "buro-finans-runtime-v6";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  "/app.webmanifest",
  "/manifest.json",
  "/icon.svg",
  "/pwa-icons/icon-192.png",
  "/pwa-icons/icon-512.png",
  "/pwa-icons/apple-touch-icon.png",
  OFFLINE_URL
];
const APP_SHELL_ROUTES = new Set(["/install", "/login"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request, url));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isImageAsset(request, url)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/reminders";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            if ("navigate" in client) {
              return client.navigate(targetUrl).then((nextClient) => nextClient?.focus());
            }

            return client.focus();
          }
        }

        return self.clients.openWindow(targetUrl);
      })
  );
});

async function networkFirstNavigation(request, url) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok && APP_SHELL_ROUTES.has(url.pathname)) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedRoute = await cache.match(request);
    const offline = await caches.match(OFFLINE_URL);
    return cachedRoute || offline || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => cached);

  return cached || network;
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}

function isStaticAsset(request, url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/app.webmanifest" ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/icon.svg" ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font"
  );
}

function isImageAsset(request, url) {
  return url.pathname.startsWith("/pwa-icons/") || request.destination === "image";
}
