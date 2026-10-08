import { loadConfig } from "../config/env.js";
import { requireAdmin, SESSION_TTL_SECONDS } from "../middleware/adminAuth.js";
import {
  assertLoginAllowed, recordLoginFailure, clearLoginFailures,
  assertSecretKeyAttemptsAllowed, recordSecretKeyFailure, clearSecretKeyFailures,
} from "../middleware/rateLimit.js";
import { jsonSuccess, jsonError } from "../utils/response.js";
import { signJwt } from "../utils/jwt.js";
import { serializeCookie, ADMIN_SESSION_COOKIE } from "../utils/cookies.js";
import {
  findAdminByUsername, findAdminById, touchLastLogin, toSafeAdmin,
  ensureAdminIndexes, createAdmin, setAdminPassword,
} from "../services/db/admin.service.js";
import { verifyPassword, hashPassword, secretsEqual, DUMMY_PASSWORD_HASH } from "../utils/password.js";

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

const MAX_AUTH_BODY_CHARS = 8 * 1024; // auth payloads are tiny; refuse anything larger up front
const MAX_USERNAME_CHARS = 254; // legacy admins may sign in with an email address
const MAX_PASSWORD_CHARS = 256;
const MAX_SECRET_KEY_CHARS = 512;

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/** Reads a small JSON object body. Returns null for missing/invalid JSON or a non-object. */
async function readAuthBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_AUTH_BODY_CHARS) throw fail("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  let text;
  try { text = await request.text(); } catch { return null; }
  if (text.length > MAX_AUTH_BODY_CHARS) throw fail("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

let warnedWeakSecret = false;
function warnIfWeakJwtSecret(secret) {
  if (!warnedWeakSecret && secret.length < 32) {
    warnedWeakSecret = true;
    // Never logs the value itself — only the fact that it is short.
    console.warn("ADMIN_JWT_SECRET is shorter than 32 characters; rotate it to a long random value.");
  }
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

  warnIfWeakJwtSecret(config.adminJwtSecret);

  const body = await readAuthBody(request);
  const { username, password } = body || {};
  if (
    typeof username !== "string" || !username.trim() || username.length > MAX_USERNAME_CHARS ||
    typeof password !== "string" || !password || password.length > MAX_PASSWORD_CHARS
  ) {
    return jsonError("Username and password are required.", { status: 400, code: "INVALID_INPUT", allowedOrigin: config.allowedOrigin });
  }

  // Best-effort, per-isolate only — see middleware/rateLimit.js for limitations.
  // Only FAILED attempts count and every lock expires by itself.
  assertLoginAllowed(request, username);

  const admin = await findAdminByUsername(config, username);
  const usable = !!admin && admin.active !== false;

  // Always run one PBKDF2 verification (against a dummy hash for unknown/inactive users) so the
  // response time does not reveal whether the username exists.
  const passwordValid = await verifyPassword(password, usable ? admin.passwordHash : DUMMY_PASSWORD_HASH);
  if (!usable || !passwordValid) {
    recordLoginFailure(request, username);
    throw genericCredentialsError();
  }

  clearLoginFailures(request, username);
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
const MIN_PASSWORD_CHARS = 12;

/**
 * Shared by register + reset: checks the admin secret key.
 * Constant-time (length-independent), brute-force throttled, and never echoes the key.
 */
async function assertSecretKey(request, config, provided) {
  assertSecretKeyAttemptsAllowed(request);
  if (!config.adminRegisterKey) throw fail("Admin secret key is not configured on this environment.", 500, "CONFIG_ERROR");

  const ok = typeof provided === "string" && provided.length <= MAX_SECRET_KEY_CHARS && (await secretsEqual(provided, config.adminRegisterKey));
  // Same generic message for a wrong key, so nothing is revealed.
  if (!ok) {
    recordSecretKeyFailure(request);
    throw fail("Invalid secret key.", 403, "INVALID_SECRET_KEY");
  }
  clearSecretKeyFailures(request);
}

/** New passwords (register + reset): at least 12 characters, not trivially weak, not the username. */
function checkNewPassword(password, username) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_CHARS) {
    throw fail(`Password must be at least ${MIN_PASSWORD_CHARS} characters.`, 400, "INVALID_INPUT");
  }
  if (password.length > MAX_PASSWORD_CHARS) throw fail("Password is too long.", 400, "INVALID_INPUT");
  if (/^(.)\1+$/.test(password)) throw fail("Password is too easy to guess.", 400, "INVALID_INPUT");
  if (username && username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) {
    throw fail("Password must not contain the username.", 400, "INVALID_INPUT");
  }
}

/**
 * POST /api/admin/register  { username, password, secretKey }
 * Creates an admin account. The secret key is the gate: without ADMIN_REGISTER_KEY configured
 * the endpoint is closed, and ADMIN_REGISTRATION_DISABLED=true closes it deliberately.
 */
export async function register(request, env) {
  const config = loadConfig(env);
  const body = (await readAuthBody(request)) || {};
  if (config.adminRegistrationDisabled) throw fail("Admin registration is disabled.", 403, "REGISTRATION_DISABLED");
  await assertSecretKey(request, config, body.secretKey);

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!USERNAME_RE.test(username)) {
    throw fail("Username must be 3–32 characters: letters, numbers, dot, dash or underscore.", 400, "INVALID_INPUT");
  }
  checkNewPassword(body.password, username);

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
 * All sessions issued before the reset stop working (see setAdminPassword / requireAdmin).
 */
export async function resetPassword(request, env) {
  const config = loadConfig(env);
  const body = (await readAuthBody(request)) || {};
  await assertSecretKey(request, config, body.secretKey);

  const username = typeof body.username === "string" && body.username.length <= MAX_USERNAME_CHARS ? body.username.trim().toLowerCase() : "";
  checkNewPassword(body.newPassword, username);

  const admin = username ? await findAdminByUsername(config, username) : null;
  if (!admin || admin.active === false) throw fail("No admin account found with that username.", 404, "NOT_FOUND");

  await setAdminPassword(config, admin._id, await hashPassword(body.newPassword));
  return jsonSuccess({ reset: true }, { allowedOrigin: config.allowedOrigin });
}
