/**
 * Handles CORS preflight (OPTIONS) requests.
 * Returns a Response if the request was a preflight request, otherwise null.
 *
 * `allowedOrigin` comes from resolveAllowedOrigin(env): a concrete origin, "*" (non-production
 * only) or null (no CORS headers at all). Credentials are only ever allowed for a concrete origin.
 */
export function handlePreflight(request, allowedOrigin) {
  if (request.method !== "OPTIONS") return null;

  const headers = { Vary: "Origin" };
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
    if (allowedOrigin !== "*") headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    headers["Access-Control-Max-Age"] = "600";
  }

  return new Response(null, { status: 204, headers });
}
