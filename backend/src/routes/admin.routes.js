import { loadConfig } from "../config/env.js";
import { requireAdmin, SESSION_TTL_SECONDS } from "../middleware/adminAuth.js";
import { enforceLoginRateLimit } from "../middleware/rateLimit.js";
import { jsonSuccess, jsonError } from "../utils/response.js";
import { safeParseJson } from "../utils/validate.js";
import { signJwt } from "../utils/jwt.js";
import { serializeCookie, ADMIN_SESSION_COOKIE } from "../utils/cookies.js";
import {
  findAdminByUsername, findAdminById, touchLastLogin, toSafeAdmin,
  ensureAdminIndexes, createAdmin, setAdminPassword,
} from "../services/db/admin.service.js";
import { verifyPassword, hashPassword, timingSafeEqual } from "../utils/password.js";

/**
 * Admin API routes (authenticated except /login).
 * Content management endpoints (Aqeedah, Masail, Categories, Articles)
 * will be added here once the content architecture is built, each
 * guarded by requireAdmin.
 */

function genericCredentialsError() {
  const err = new Error("Invalid username or password.");
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
  const { username, password } = body || {};
  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password || password.length > 256) {
    return jsonError("Username and password are required.", { status: 400, code: "INVALID_INPUT", allowedOrigin: config.allowedOrigin });
  }

  // Best-effort, per-isolate only — see middleware/rateLimit.js for limitations.
  enforceLoginRateLimit(request, username);

  const admin = await findAdminByUsername(config, username);
  if (!admin || admin.active === false) {
    throw genericCredentialsError();
  }

  const passwordValid = await verifyPassword(password, admin.passwordHash);
  if (!passwordValid) {
    throw genericCredentialsError();
  }

  await touchLastLogin(config, admin._id);

  const token = await signJwt(
    { sub: String(admin._id), username: admin.username || admin.email, role: admin.role },
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

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/** Shared by register + reset: checks the admin secret key (constant-time). */
function assertSecretKey(config, provided) {
  if (!config.adminRegisterKey) throw fail("Admin secret key is not configured on this environment.", 500, "CONFIG_ERROR");
  const ok = typeof provided === "string" && timingSafeEqual(provided, config.adminRegisterKey);
  // Same generic message for a wrong key, so nothing is revealed.
  if (!ok) throw fail("Invalid secret key.", 403, "INVALID_SECRET_KEY");
}

function checkNewPassword(password) {
  if (typeof password !== "string" || password.length < 8) throw fail("Password must be at least 8 characters.", 400, "INVALID_INPUT");
  if (password.length > 256) throw fail("Password is too long.", 400, "INVALID_INPUT");
}

/**
 * POST /api/admin/register  { username, password, secretKey }
 * Creates an admin account. Allowed any number of times — the secret key is the gate.
 */
export async function register(request, env) {
  const config = loadConfig(env);
  const body = (await safeParseJson(request)) || {};
  enforceLoginRateLimit(request, "register");
  assertSecretKey(config, body.secretKey);

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!USERNAME_RE.test(username)) {
    throw fail("Username must be 3–32 characters: letters, numbers, dot, dash or underscore.", 400, "INVALID_INPUT");
  }
  checkNewPassword(body.password);

  await ensureAdminIndexes(config);
  if (await findAdminByUsername(config, username)) throw fail("This username is already taken.", 409, "USERNAME_TAKEN");

  try {
    await createAdmin(config, { username, passwordHash: await hashPassword(body.password) });
  } catch (e) {
    if (e?.code === 11000) throw fail("This username is already taken.", 409, "USERNAME_TAKEN");
    throw e;
  }
  return jsonSuccess({ registered: true }, { status: 201, allowedOrigin: config.allowedOrigin });
}

/**
 * POST /api/admin/reset-password  { username, secretKey, newPassword }
 * Forgot-password flow: the admin secret key authorises setting a new password.
 */
export async function resetPassword(request, env) {
  const config = loadConfig(env);
  const body = (await safeParseJson(request)) || {};
  enforceLoginRateLimit(request, "reset");
  assertSecretKey(config, body.secretKey);
  checkNewPassword(body.newPassword);

  const admin = typeof body.username === "string" ? await findAdminByUsername(config, body.username) : null;
  if (!admin || admin.active === false) throw fail("No admin account found with that username.", 404, "NOT_FOUND");

  await setAdminPassword(config, admin._id, await hashPassword(body.newPassword));
  return jsonSuccess({ reset: true }, { allowedOrigin: config.allowedOrigin });
}
