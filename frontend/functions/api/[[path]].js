// Cloudflare Pages Function: forwards /api/* to the backend Worker.
// Browser <-> site stays same-origin, so login cookies are first-party (no CORS, no third-party cookie issues).
// Optional: set API_ORIGIN in Pages env vars to override the default Worker URL below.
const DEFAULT_API_ORIGIN = "https://atharitvbackend.debatermuhammadrazasalafi.workers.dev";

// The backend Worker (free plan) sometimes dies with Cloudflare error 1102 / 503 because connecting to MongoDB
// uses more CPU than the free limit allows. That failure is random per request, so this proxy hides it:
//  1) Public read endpoints are kept at the edge. A copy younger than FRESH_MS is served without calling the Worker.
//     If the Worker fails, the last good copy (up to a day old) is served instead of an error.
//  2) Every other request (admin login, save, publish ...) is retried automatically when the Worker answers 502/503/504.
// Errors are never stored in the cache. Admin, payment and media routes are never cached.
const FRESH_MS = 120_000;
const STALE_MAX_SECONDS = 86_400;
const RETRY_DELAYS_MS = [250, 700];
const RETRY_STATUSES = new Set([502, 503, 504]);
const EDGE_CACHEABLE = /^\/api\/public\/(home|categories|topics|folders|folders\/by-slug|latest|search|articles|articles\/[^/]+|references|live-sessions|live-sessions\/[^/]+|courses|courses\/[^/]+)\/?$/;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(makeRequest, delays) {
  for (let attempt = 0; ; attempt += 1) {
    let res;
    try {
      res = await fetch(makeRequest());
    } catch (err) {
      if (attempt >= delays.length) throw err;
      await sleep(delays[attempt]);
      continue;
    }
    if (!RETRY_STATUSES.has(res.status) || attempt >= delays.length) return res;
    await sleep(delays[attempt]);
  }
}

const unavailable = () =>
  new Response(JSON.stringify({ success: false, error: "Service temporarily unavailable, please retry." }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });

export async function onRequest({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const origin = (env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, "");
  const target = origin + url.pathname + url.search;
  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const makeRequest = () => new Request(target, { method, headers: request.headers, body, redirect: "manual" });

  if (method === "GET" && EDGE_CACHEABLE.test(url.pathname)) {
    const cache = caches.default;
    const key = new Request(url.origin + url.pathname + url.search, { method: "GET" });
    const hit = await cache.match(key);
    const age = hit ? Date.now() - Number(hit.headers.get("x-cached-at") || 0) : Infinity;
    if (hit && age < FRESH_MS) return hit;

    let res = null;
    try {
      res = await fetchWithRetry(makeRequest, hit ? [] : RETRY_DELAYS_MS);
    } catch {
      res = null;
    }

    if (res && res.ok) {
      const headers = new Headers(res.headers);
      headers.delete("set-cookie");
      headers.set("cache-control", `public, max-age=${STALE_MAX_SECONDS}`);
      headers.set("x-cached-at", String(Date.now()));
      const copy = res.clone();
      const stored = new Response(copy.body, { status: copy.status, headers });
      waitUntil(cache.put(key, stored).catch(() => {}));
      return res;
    }

    if (hit && (!res || res.status >= 500)) {
      const headers = new Headers(hit.headers);
      headers.set("x-stale", "1");
      return new Response(hit.body, { status: hit.status, headers });
    }
    return res || unavailable();
  }

  try {
    return await fetchWithRetry(makeRequest, RETRY_DELAYS_MS);
  } catch {
    return unavailable();
  }
}
