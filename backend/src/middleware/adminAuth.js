import { verifyJwt } from "../utils/jwt.js";
import { parseCookies, ADMIN_SESSION_COOKIE } from "../utils/cookies.js";
import { loadConfig } from "../config/env.js";
import { findAdminById } from "../services/db/admin.service.js";

/**
 * Admin session lifetime. Exported so the login route signs tokens with
 * the same value used to validate them here.
 */
export const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours

function unauthenticated(code = "UNAUTHENTICATED") {
  const err = new Error("Not authenticated.");
  err.status = 401;
  err.code = code;
  return err;
}

async function verifySession(request, env) {
  if (!env.ADMIN_JWT_SECRET) {
    const err = new Error("Admin authentication is not configured on this environment.");
    err.status = 500;
    err.code = "CONFIG_ERROR";
    throw err;
  }

  const cookies = parseCookies(request);
  const token = cookies[ADMIN_SESSION_COOKIE];
  if (!token) throw unauthenticated();

  // verifyJwt throws a well-formed 401 for malformed/forged/expired tokens or missing claims.
  const payload = await verifyJwt(token, env.ADMIN_JWT_SECRET);

  // The token alone is not enough: the admin must still exist, still be active, and must
  // not have had their password reset since this token was issued. This is what makes
  // deactivation and password reset take effect immediately instead of after the 2h expiry.
  const admin = await findAdminById(loadConfig(env), payload.sub);
  if (!admin || admin.active === false) throw unauthenticated();

  const changedAt = admin.passwordChangedAt instanceof Date ? admin.passwordChangedAt.getTime() : null;
  // `>=`: a token issued in the same second as the reset is treated as older (fail closed).
  if (changedAt !== null && Math.floor(changedAt / 1000) >= payload.iat) {
    throw unauthenticated("SESSION_REVOKED");
  }

  return { ...payload, role: admin.role || payload.role };
}

// One verification (and one DB lookup) per request, even though both the router-level
// guard and the individual controllers call requireAdmin.
const verifiedRequests = new WeakMap();

/**
 * Verifies the admin session cookie and returns its decoded payload
 * ({ sub, username, role, iat, exp }). Throws a 401 on any failure.
 *
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<{ sub: string, username: string, role: string }>}
 */
export async function requireAdmin(request, env) {
  let pending = verifiedRequests.get(request);
  if (!pending) {
    pending = verifySession(request, env);
    verifiedRequests.set(request, pending);
  }
  return pending;
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
