/* 红楼/西游三消乐 · Service Worker（离线缓存）
 * - 核心页面/资源：在线优先拿最新，离线回退缓存（断网也能玩）
 * - tts 讲读音频：网络优先，成功即写入运行时缓存（播过即可离线重听）
 * - 不支持 Service Worker 的环境（如微信内置浏览器）自动忽略，无副作用
 */
const VERSION = 'v1';
const CORE_CACHE = 'sgs-core-' + VERSION;
const RUNTIME_CACHE = 'sgs-rt-' + VERSION;

// 预缓存清单（相对 sw.js 所在 scope，即 /game/ 下）
const CORE_ASSETS = [
  './',
  './index.html',
  './hlgc-wechat.html',
  './xyxx-wechat.html',
  './扫码进入-红楼西游三消乐-R15.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== CORE_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isTts(url) {
  return /\/tts\//.test(url.pathname) && /\.mp3(\?|$)/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 仅处理同源

  // tts 音频：网络优先，命中即写入运行时缓存（离线可重听）
  if (isTts(url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cache.match(req))
      )
    );
    return;
  }

  // 核心资源/页面：在线优先拿最新，离线回退缓存
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CORE_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
