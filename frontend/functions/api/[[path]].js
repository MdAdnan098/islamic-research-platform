// Cloudflare Pages Function: forwards /api/* to the backend Worker.
// Browser <-> site stays same-origin, so login cookies are first-party (no CORS, no third-party cookie issues).
// Optional: set API_ORIGIN in Pages env vars to override the default Worker URL below.
const DEFAULT_API_ORIGIN = "https://islamic-research-backend.rungtastudenthub.workers.dev";

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const origin = (env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, "");
  return fetch(new Request(origin + url.pathname + url.search, request));
}