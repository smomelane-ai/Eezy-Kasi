// Service worker for Inanda Business Web.
// Change VERSION whenever you change any file, so phones pick up the new version.
const VERSION = "inanda-v44";
const FEED_CACHE = "inanda-feed-v1";                       // news text, video list and news pictures (kept between versions)
const SB_HOST = "zcqkydqrsriijjwaajjw.supabase.co";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FEED_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Videos are never saved: they stream live from the network when someone taps play.
const isVideo = (r, u) => r.destination === "video" || r.destination === "audio" || r.headers.has("range")
  || /\.(mp4|webm|mov|m4v|m3u8|ogg|ogv)$/i.test(u.pathname);

async function notify() {
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach(c => c.postMessage({ type: "feed-updated" }));
}
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
// Stale-while-revalidate: answer from the saved copy straight away, refresh it in the background.
async function swr(e, max) {
  const cache = await caches.open(FEED_CACHE), isImg = e.request.destination === "image";
  const hit = await cache.match(e.request, { ignoreVary: true });
  const net = fetch(e.request).then(async res => {
    if (res.ok) {
      const old = hit && !isImg ? await hit.clone().text() : null;
      await cache.put(e.request, res.clone());
      if (old !== null && (await res.clone().text()) !== old) notify();   // tell the open page there is fresh news
      if (max) trim(cache, max);
    }
    return res;
  }).catch(() => null);
  e.waitUntil(net);
  return hit || (await net) || (isImg ? new Response("", { status: 504 })
    : new Response("[]", { status: 503, headers: { "Content-Type": "application/json" } }));
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);

  if (isVideo(r, u)) return;                                  // 1. videos: straight to the network, never cached

  if (u.hostname === SB_HOST) {
    if (/^\/rest\/v1\/(inanda_news|funny_videos)/.test(u.pathname)) {                                         // 2. news text + video list
      if (r.cache === "no-store" || r.cache === "reload") {                                                    // "Refresh" or just posted: ask the network first
        e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(FEED_CACHE).then(ca => ca.put(r.url, c)); } return res; }));
        return;
      }
      e.respondWith(swr(e)); return;
    }
    if (r.destination === "image" && u.pathname.startsWith("/storage/v1/object/public/inanda-media/")) { e.respondWith(swr(e, 60)); return; } // 3. news pictures
    return;                                                   // everything else on Supabase (logins, orders, payments) is never cached
  }

  if (r.mode === "navigate") {                                // the app page: network first, saved copy offline
    e.respondWith(fetch(r).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put("index.html", copy));
      return res;
    }).catch(() => caches.match("index.html")));
    return;
  }
  if (u.origin === location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {   // our files and fonts
    e.respondWith(caches.match(r).then(hit => {
      const net = fetch(r).then(res => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
  }
});

// ---- push alerts (sent by the server, shown even when the app is closed) ----
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    if (cs.some(c => c.visibilityState === "visible")) return;   // the app is open on screen: it plays its own sound
    return self.registration.showNotification(d.title || "Inanda Business Web", {
      body: d.body || "You have something new.",
      icon: "icons/icon-192.png", badge: "icons/icon-192.png",
      tag: d.tag || "inanda", renotify: true, vibrate: [150, 80, 150],
      data: { url: d.url || "./" }
    });
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ("focus" in c) return c.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
  }));
});
