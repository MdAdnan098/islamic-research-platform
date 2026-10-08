/**
 * Best-effort abuse protection for the admin auth endpoints.
 *
 * IMPORTANT LIMITATION: this state lives in module-scope memory, so it
 * only persists for the lifetime of a single warm Worker isolate. It is
 * NOT shared across Cloudflare's edge locations or across isolate
 * restarts/deploys, so a distributed attacker can bypass it by hitting
 * different edge nodes. It only helps against basic single-source abuse.
 *
 * For real production-grade protection, add a Cloudflare Rate Limiting
 * Rule (dashboard/WAF) on /api/admin/login, /api/admin/register and
 * /api/admin/reset-password, or a Durable Object-backed limiter.
 *
 * Design: only FAILED attempts are counted, and a successful login clears
 * its counter. A legitimate admin therefore never burns budget by signing in,
 * and every lock expires on its own when the window ends — nobody is locked
 * out permanently.
 */

const FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS_PER_ACCOUNT = 8; // same IP + same username
const MAX_FAILS_PER_IP = 25; // same IP, any username
const MAX_SECRET_KEY_FAILS_PER_IP = 5; // wrong ADMIN_REGISTER_KEY (register + reset share this)
const MAX_SECRET_KEY_FAILS_GLOBAL = 30; // wrong key from anywhere, per isolate
const MAX_TRACKED_KEYS = 5000;

const failures = new Map(); // key -> { count, windowStart }

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

/** Bounded, normalised username so attacker-supplied input cannot bloat the map. */
function normalizeName(username) {
  return String(username || "").trim().toLowerCase().slice(0, 64);
}

function prune(now) {
  if (failures.size <= MAX_TRACKED_KEYS) return;
  for (const [k, v] of failures) if (now - v.windowStart > FAIL_WINDOW_MS) failures.delete(k);
  // Still full of live entries: drop the oldest ones rather than grow without bound.
  if (failures.size > MAX_TRACKED_KEYS) {
    let excess = failures.size - MAX_TRACKED_KEYS;
    for (const k of failures.keys()) { failures.delete(k); if (--excess <= 0) break; }
  }
}

function tooMany(retryAfterSeconds) {
  const err = new Error("Too many failed attempts. Please try again later.");
  err.status = 429;
  err.code = "RATE_LIMITED";
  err.retryAfter = retryAfterSeconds;
  return err;
}

/** Throws 429 if `key` has already reached `max` failures inside the current window. */
function assertBelow(key, max, now) {
  const entry = failures.get(key);
  if (!entry) return;
  if (now - entry.windowStart > FAIL_WINDOW_MS) { failures.delete(key); return; }
  if (entry.count >= max) throw tooMany(Math.max(1, Math.ceil((entry.windowStart + FAIL_WINDOW_MS - now) / 1000)));
}

function bump(key, now) {
  const entry = failures.get(key);
  if (!entry || now - entry.windowStart > FAIL_WINDOW_MS) failures.set(key, { count: 1, windowStart: now });
  else entry.count += 1;
}

/** Call BEFORE checking credentials. Throws 429 while this IP/username is locked. */
export function assertLoginAllowed(request, username, now = Date.now()) {
  const ip = clientIp(request);
  assertBelow(`login-ip:${ip}`, MAX_FAILS_PER_IP, now);
  assertBelow(`login:${ip}:${normalizeName(username)}`, MAX_FAILS_PER_ACCOUNT, now);
}

/** Call after a failed credential check (unknown user, inactive user or wrong password). */
export function recordLoginFailure(request, username, now = Date.now()) {
  prune(now);
  const ip = clientIp(request);
  bump(`login-ip:${ip}`, now);
  bump(`login:${ip}:${normalizeName(username)}`, now);
}

/** Call after a successful login so a legitimate admin starts clean. */
export function clearLoginFailures(request, username) {
  failures.delete(`login:${clientIp(request)}:${normalizeName(username)}`);
}

/** Register / reset-password: guards guessing of the admin secret key. */
export function assertSecretKeyAttemptsAllowed(request, now = Date.now()) {
  assertBelow(`secret-ip:${clientIp(request)}`, MAX_SECRET_KEY_FAILS_PER_IP, now);
  assertBelow("secret-global", MAX_SECRET_KEY_FAILS_GLOBAL, now);
}

export function recordSecretKeyFailure(request, now = Date.now()) {
  prune(now);
  bump(`secret-ip:${clientIp(request)}`, now);
  bump("secret-global", now);
}

export function clearSecretKeyFailures(request) {
  failures.delete(`secret-ip:${clientIp(request)}`);
}

/** Test helper: forget all recorded failures. */
export function _resetAuthLimiterForTests() {
  failures.clear();
}

/**
 * Generic best-effort limiter for the public payment / enrollment
 * endpoints. Same per-isolate limitation as above (see the note at the
 * top of this file) — add a Cloudflare Rate Limiting rule for these
 * paths for real protection.
 */
const genericBuckets = new Map(); // key -> { count, windowStart }

/**
 * @param {Request} request
 * @param {string} bucket - label for the endpoint (e.g. "payment-order")
 * @param {{ max?: number, windowMs?: number }} [opts]
 */
export function enforceRateLimit(request, bucket, { max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  // Keep memory bounded on a long-lived isolate.
  if (genericBuckets.size > 5000) {
    for (const [k, v] of genericBuckets) if (now - v.windowStart > windowMs) genericBuckets.delete(k);
  }

  const entry = genericBuckets.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    genericBuckets.set(key, { count: 1, windowStart: now });
    return;
  }

  entry.count += 1;
  if (entry.count > max) {
    const err = new Error("Too many requests. Please try again later.");
    err.status = 429;
    err.code = "RATE_LIMITED";
    throw err;
  }
}
