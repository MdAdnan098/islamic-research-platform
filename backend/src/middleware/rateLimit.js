/**
 * Best-effort login rate limiting.
 *
 * IMPORTANT LIMITATION: this state lives in module-scope memory, so it
 * only persists for the lifetime of a single warm Worker isolate. It is
 * NOT shared across Cloudflare's edge locations or across isolate
 * restarts/deploys, so a distributed attacker can bypass it by hitting
 * different edge nodes. It only helps against basic single-source abuse.
 *
 * For real production-grade protection, use Cloudflare's Rate Limiting
 * Rules (dashboard/WAF) or a Durable Object-backed limiter — not
 * implemented here to avoid adding architecture beyond this phase's scope.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

const attempts = new Map(); // key -> { count, windowStart }

function keyFor(request, email) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  return `${ip}:${(email || "").toLowerCase()}`;
}

/**
 * Throws a 429 if the caller has exceeded the attempt budget for this
 * isolate's recent window. Call once per login attempt (success or fail).
 */
export function enforceLoginRateLimit(request, email) {
  // `email` is just the bucket label (username or "register"/"reset").
  const key = keyFor(request, email);
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return;
  }

  entry.count += 1;

  if (entry.count > MAX_ATTEMPTS) {
    const err = new Error("Too many login attempts. Please try again later.");
    err.status = 429;
    err.code = "RATE_LIMITED";
    throw err;
  }
}
