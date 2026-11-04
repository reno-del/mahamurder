// 홈 화면 설치(PWA)용 서비스 워커. main.tsx가 배포 빌드에서만 등록한다.
// 화면(HTML)은 항상 네트워크를 먼저 써서 배포하면 바로 새 버전이 뜨고, 오프라인일 때만 저장본을 보여 준다.
// 이름에 해시가 붙는 /assets/* 는 바뀌지 않으므로 한 번 받으면 저장본을 쓴다.
// Firestore·Google 로그인(/__/)·글꼴·표지 이미지 등 나머지 요청은 건드리지 않는다.
// 새 모임·전체 공지 알림(scripts/send-push.mjs가 FCM으로 보냄)도 여기서 받아 보여 준다.
const PAGES = "mm-pages-v1";
const ASSETS = "mm-assets-v1";
const MAX_ASSETS = 80;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== PAGES && key !== ASSETS) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/__/")) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // 처음 가 보는 주소라도 앱 화면(index.html)만 있으면 라우터가 그린다
    const saved = (await cache.match(req)) || (await cache.match("/games")) || (await cache.match("/"));
    if (saved) return saved;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(req);
  if (saved) return saved;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    // 배포할 때마다 새 파일이 쌓이므로 오래된 것부터 지운다
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(key);
  }
  return res;
}

// FCM data 메시지: { data: { title, body, link, tag } }. 아이폰은 받은 푸시마다 알림을 꼭 띄워야 한다
self.addEventListener("push", (event) => {
  let data = {};
  try {
    const payload = event.data ? event.data.json() : {};
    data = payload.data || payload;
  } catch {
    /* 형식이 다른 푸시도 기본 문구로 띄운다 */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "머더미스터리 클럽", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icon-192.png",
      data: { link: data.link || "/schedule" },
    }),
  );
});

// 알림을 누르면 열려 있는 창이 있으면 그 창에서, 없으면 새 창으로 해당 일정을 연다
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || "/schedule", location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const win = wins.find((w) => new URL(w.url).origin === location.origin);
      if (win) {
        try {
          await win.focus();
          await win.navigate(url);
          return;
        } catch {
          /* 제어하지 않는 창이면 navigate가 실패하므로 새 창으로 */
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
