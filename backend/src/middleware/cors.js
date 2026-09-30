/**
 * Handles CORS preflight (OPTIONS) requests.
 * Returns a Response if the request was a preflight request, otherwise null.
 */
export function handlePreflight(request, allowedOrigin) {
  if (request.method !== "OPTIONS") return null;

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin || "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
