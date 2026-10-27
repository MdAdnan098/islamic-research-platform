// Cloudflare Pages Function: forwards /api/* to the backend Worker.
// Browser <-> site stays same-origin, so login cookies are first-party (no CORS, no third-party cookie issues).
// Optional: set API_ORIGIN in Pages env vars to override the default Worker URL below.
const DEFAULT_API_ORIGIN = "https://atharitvbackend.debatermuhammadrazasalafi.workers.dev";

// Public, cookie-independent read endpoints are cached at Cloudflare's edge for a short time, so a burst of
// visitors is answered from the edge instead of every request reaching the Worker + MongoDB (the cause of the
// 503 errors under load). Errors (4xx/5xx) are never cached. Admin, payment and media routes are never cached.
const EDGE_TTL_SECONDS = 30;
const EDGE_CACHEABLE = /^\/api\/public\/(home|categories|topics|folders|folders\/by-slug|latest|search|articles|articles\/[^/]+|references|live-sessions|live-sessions\/[^/]+|courses|courses\/[^/]+)\/?$/;

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const origin = (env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, "");
  const upstream = new Request(origin + url.pathname + url.search, request);

  if (request.method === "GET" && EDGE_CACHEABLE.test(url.pathname)) {
    return fetch(upstream, {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { "200-299": EDGE_TTL_SECONDS, "300-599": 0 },
      },
    });
  }
  return fetch(upstream);
}
