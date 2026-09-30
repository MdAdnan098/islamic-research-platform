import { loadConfig } from "../config/env.js";
import { requireAdmin, SESSION_TTL_SECONDS } from "../middleware/adminAuth.js";
import { enforceLoginRateLimit } from "../middleware/rateLimit.js";
import { jsonSuccess, jsonError } from "../utils/response.js";
import { validateLoginInput, safeParseJson } from "../utils/validate.js";
import { signJwt } from "../utils/jwt.js";
import { serializeCookie, ADMIN_SESSION_COOKIE } from "../utils/cookies.js";
import { findAdminByEmail, findAdminById, touchLastLogin, toSafeAdmin } from "../services/db/admin.service.js";
import { verifyPassword } from "../utils/password.js";

/**
 * Admin API routes (authenticated except /login).
 * Content management endpoints (Aqeedah, Masail, Categories, Articles)
 * will be added here once the content architecture is built, each
 * guarded by requireAdmin.
 */

function genericCredentialsError() {
  const err = new Error("Invalid email or password.");
  err.status = 401;
  err.code = "INVALID_CREDENTIALS";
  return err;
}

/**
 * POST /api/admin/login
 * Verifies credentials against the `admins` collection and issues an
 * HttpOnly session cookie containing a signed JWT.
 */
export async function login(request, env) {
  const config = loadConfig(env);

  if (!config.adminJwtSecret) {
    return jsonError("Admin authentication is not configured on this environment.", {
      status: 500,
      code: "CONFIG_ERROR",
      allowedOrigin: config.allowedOrigin,
    });
  }

  const body = await safeParseJson(request);
  const errors = validateLoginInput(body);
  if (errors.length > 0) {
    return jsonError(errors[0], { status: 400, code: "INVALID_INPUT", allowedOrigin: config.allowedOrigin });
  }

  const { email, password } = body;

  // Best-effort, per-isolate only — see middleware/rateLimit.js for limitations.
  enforceLoginRateLimit(request, email);

  const admin = await findAdminByEmail(config, email);
  if (!admin || admin.active === false) {
    throw genericCredentialsError();
  }

  const passwordValid = await verifyPassword(password, admin.passwordHash);
  if (!passwordValid) {
    throw genericCredentialsError();
  }

  await touchLastLogin(config, admin._id);

  const token = await signJwt(
    { sub: String(admin._id), email: admin.email, role: admin.role },
    config.adminJwtSecret,
    { expiresInSeconds: SESSION_TTL_SECONDS }
  );

  const cookie = serializeCookie(ADMIN_SESSION_COOKIE, token, {
    maxAgeSeconds: SESSION_TTL_SECONDS,
    secure: config.environment === "production",
  });

  return jsonSuccess(
    { admin: toSafeAdmin(admin) },
    { allowedOrigin: config.allowedOrigin, headers: { "Set-Cookie": cookie } }
  );
}

/**
 * POST /api/admin/logout
 * Clears the session cookie. Idempotent — succeeds even without a
 * valid/any existing session.
 */
export async function logout(request, env) {
  const config = loadConfig(env);

  const cookie = serializeCookie(ADMIN_SESSION_COOKIE, "", {
    maxAgeSeconds: 0,
    secure: config.environment === "production",
  });

  return jsonSuccess(
    { loggedOut: true },
    { allowedOrigin: config.allowedOrigin, headers: { "Set-Cookie": cookie } }
  );
}

/**
 * GET /api/admin/me
 * Returns the current admin's safe profile. Re-fetches from the database
 * (rather than trusting the JWT payload alone) so a deactivated admin
 * loses access immediately, not just after their token expires.
 */
export async function me(request, env) {
  const config = loadConfig(env);
  const session = await requireAdmin(request, env);

  const admin = await findAdminById(config, session.sub);
  if (!admin || admin.active === false) {
    const err = new Error("Not authenticated.");
    err.status = 401;
    err.code = "UNAUTHENTICATED";
    throw err;
  }

  return jsonSuccess({ admin: toSafeAdmin(admin) }, { allowedOrigin: config.allowedOrigin });
}

/**
 * GET /api/admin/ping
 * Simple authenticated reachability check, useful for verifying the
 * middleware wiring independently of the /me DB round-trip.
 */
export async function ping(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  return jsonSuccess({ message: "Admin API is reachable." }, { allowedOrigin: config.allowedOrigin });
}
