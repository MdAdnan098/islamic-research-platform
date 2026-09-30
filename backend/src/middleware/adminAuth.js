import { verifyJwt } from "../utils/jwt.js";
import { parseCookies, ADMIN_SESSION_COOKIE } from "../utils/cookies.js";

/**
 * Admin session lifetime. Exported so the login route signs tokens with
 * the same value used to validate them here.
 */
export const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours

/**
 * Verifies the admin session cookie and returns its decoded payload
 * ({ sub, email, role, iat, exp }).
 *
 * Same signature/contract as before (throws on failure, returns on
 * success) so existing callers (e.g. the /api/admin/ping route) keep
 * working unchanged — only the internal logic is now real.
 *
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<{ sub: string, email: string, role: string }>}
 */
export async function requireAdmin(request, env) {
  if (!env.ADMIN_JWT_SECRET) {
    const err = new Error("Admin authentication is not configured on this environment.");
    err.status = 500;
    err.code = "CONFIG_ERROR";
    throw err;
  }

  const cookies = parseCookies(request);
  const token = cookies[ADMIN_SESSION_COOKIE];

  if (!token) {
    const err = new Error("Not authenticated.");
    err.status = 401;
    err.code = "UNAUTHENTICATED";
    throw err;
  }

  // verifyJwt already throws a well-formed 401 for invalid/expired tokens.
  return verifyJwt(token, env.ADMIN_JWT_SECRET);
}

/**
 * Optional role gate, layered on top of requireAdmin for routes that need
 * more than "any authenticated admin" (not used yet in this phase, but
 * kept here so future modules can reuse it instead of duplicating checks).
 *
 * @param {{ role: string }} session - result of requireAdmin
 * @param {string[]} allowedRoles
 */
export function requireRole(session, allowedRoles) {
  if (!allowedRoles.includes(session.role)) {
    const err = new Error("You do not have permission to perform this action.");
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }
}
