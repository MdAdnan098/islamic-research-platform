/**
 * Standard JSON envelope helpers so every endpoint responds in the same shape:
 *   success: { success: true, data }
 *   error:   { success: false, error: { message, code } }
 */

function withCors(headers, allowedOrigin) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...headers,
  };
}

export function jsonSuccess(data, { status = 200, allowedOrigin, headers } = {}) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: withCors(headers, allowedOrigin),
  });
}

export function jsonError(message, { status = 500, code = "INTERNAL_ERROR", allowedOrigin, headers } = {}) {
  return new Response(
    JSON.stringify({ success: false, error: { message, code } }),
    {
      status,
      headers: withCors(headers, allowedOrigin),
    }
  );
}
