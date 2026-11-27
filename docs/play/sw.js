/* 山形ドライブ R13 ブラウザ版の service worker：一度開いたファイルを端末に保存し、電波がなくても遊べるようにする。
   版が変わると CACHE の名前が変わり、古い保存は消える。 */
const CACHE = 'r13-1.0.7-202611272010';
const CORE = ["./", "css/style.css", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "js/audio.js", "js/data-control.js", "js/game.js", "js/garage.js", "js/ghost.js", "js/journey.js", "js/music.js", "js/qr.js", "js/quiz.js", "js/records.js", "js/renderer.js", "js/route-data.js", "js/sights.js", "js/simulation.js", "js/traffic-rules.js", "js/vendor/qrcode-generator.js", "js/verify-code.js", "js/web-host.js", "lib/three.min.js", "manifest.webmanifest", "sights/photos.js"];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('r13-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // 音声は Range 要求で読まれることがあるため、保存済みならそのまま返し、なければ通常どおり読み込んで保存する
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit && !req.headers.get('range')) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') c.put(req, res.clone());
        return res;
      }).catch(function () { return hit || (req.mode === 'navigate' ? c.match('./index.html') : Response.error()); });
    });
  }));
});
