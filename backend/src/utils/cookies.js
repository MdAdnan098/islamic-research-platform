/**
 * Minimal cookie helpers for the admin session cookie. The session token
 * is stored in an HttpOnly cookie (not localStorage) so it isn't reachable
 * from JavaScript if the site is ever exposed to XSS.
 */

export const ADMIN_SESSION_COOKIE = "admin_session";

/** @param {Request} request */
export function parseCookies(request) {
  const header = request.headers.get("Cookie");
  if (!header) return {};

  return header.split(";").reduce((acc, pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return acc;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) {
      // A malformed %-escape must never turn into a 500 — fall back to the raw value
      // (it will simply fail token verification and yield a 401).
      try { acc[key] = decodeURIComponent(value); } catch { acc[key] = value; }
    }
    return acc;
  }, {});
}

/**
 * @param {string} name
 * @param {string} value
 * @param {{ maxAgeSeconds?: number, secure: boolean }} options
 *   maxAgeSeconds omitted/undefined => session-length; 0 => delete cookie.
 */
export function serializeCookie(name, value, { maxAgeSeconds, secure }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (secure) parts.push("Secure");
  if (typeof maxAgeSeconds === "number") parts.push(`Max-Age=${maxAgeSeconds}`);

  return parts.join("; ");
}
