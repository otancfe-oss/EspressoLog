/* EspressoLog Service Worker - 一時解除版
 * 古いキャッシュを全削除し、自身も即座にアクティベートする。
 * 新しいファイル構成（css/style.css, js/db.js, js/app.js）が安定したら
 * BrewLog と同様のPWAキャッシュ版に差し替える。
 * ※差し替え時はキャッシュバージョン文字列をデプロイ毎にインクリメントすること
 *   （しないとPWAに更新が反映されない）。
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
