/* SeatPlan PWA - Service Worker (v0.84)
   교체용 sw.js (GitHub Pages 포함)

   ✅ 변경점
   1) 캐시 이름을 버전별로 변경: seatplan-pwa-v84
   2) install에서 precache를 강제 갱신: Request(..., { cache: 'reload' })
   3) 새 SW가 즉시 잡히도록: skipWaiting + clients.claim
   4) 첫 화면(네비게이션)은 network-first로 가져와 오래된 index.html 노출을 방지
      (네트워크 실패 시 캐시된 index.html로 fallback)
*/

const CACHE_NAME = "seatplan-pwa-v84"

// 프로젝트 루트 기준(상대경로) - GitHub Pages의 서브경로 배포에도 안전
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./styles.css?v=0.84",
  "./app.js?v=0.84",
  "./manifest.webmanifest?v=0.84",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // ✅ 강제 갱신: 브라우저 HTTP 캐시를 무시하고 최신 파일을 받아 precache
      const reqs = ASSETS.map(
        (url) => new Request(url, { cache: "reload" })
      );

      await cache.addAll(reqs);

      // ✅ 즉시 활성화 대기열 스킵
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))
      );

      // ✅ 즉시 컨트롤
      await self.clients.claim();
    })()
  );
});

// 페이지에서 "업데이트 즉시 적용" 버튼을 만들고 싶다면 아래 메시지를 보내면 됨.
// navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' })
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // GET만 처리
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // ✅ 첫 화면/라우팅은 network-first로: 오래된 index.html 캐시가 먼저 뜨는 문제 방지
  if (sameOrigin && req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // 브라우저 캐시를 무시하고 최신 문서를 우선
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch (e) {
          // 오프라인/실패 시 캐시된 index.html
          const cached = await caches.match("./index.html");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 같은 오리진 정적파일은 cache-first
  if (sameOrigin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;

        try {
          const res = await fetch(req);
          // 성공 응답만 캐시
          if (res && res.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, res.clone());
          }
          return res;
        } catch (e) {
          // 오프라인 fallback: 없으면 에러
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 외부 리소스는 그냥 네트워크
  event.respondWith(fetch(req));
});
