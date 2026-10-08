/**
 * Minimal JWT (HS256) implementation using the Web Crypto API.
 * Avoids adding a `jsonwebtoken`-style dependency for what is just
 * HMAC-SHA256 signing over a small, fixed payload shape.
 */

const encoder = new TextEncoder();

function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToBuffer(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlDecodeToString(base64Url) {
  return new TextDecoder().decode(base64UrlDecodeToBuffer(base64Url));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/**
 * @param {object} payload - claims to embed (e.g. { sub, email, role })
 * @param {string} secret - ADMIN_JWT_SECRET
 * @param {{ expiresInSeconds: number }} options
 * @returns {Promise<string>} signed JWT
 */
export async function signJwt(payload, secret, { expiresInSeconds }) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const data = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(fullPayload))}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));

  return `${data}.${base64UrlEncode(signature)}`;
}

function invalidToken(message = "Invalid session token.", code = "INVALID_TOKEN") {
  const err = new Error(message);
  err.status = 401;
  err.code = code;
  return err;
}

const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const CLOCK_SKEW_SECONDS = 60;

/**
 * @param {string} token
 * @param {string} secret - ADMIN_JWT_SECRET
 * @returns {Promise<object>} decoded payload
 * @throws a 401 error on ANY problem: malformed token, wrong algorithm, bad
 *   signature, missing/invalid claims, or expiry. Nothing here can surface as a
 *   500 — decoding failures are caught and reported as an invalid token.
 */
export async function verifyJwt(token, secret) {
  if (typeof token !== "string" || token.length > 4096) throw invalidToken("Malformed session token.");

  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((part) => B64URL_RE.test(part))) {
    throw invalidToken("Malformed session token.");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  try {
    header = JSON.parse(base64UrlDecodeToString(headerB64));
  } catch {
    throw invalidToken("Malformed session token.");
  }
  // We only ever issue HS256; refuse anything else (e.g. "none") outright.
  if (!header || header.alg !== "HS256" || (header.typ !== undefined && header.typ !== "JWT")) {
    throw invalidToken();
  }

  let valid = false;
  try {
    const key = await importHmacKey(secret);
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecodeToBuffer(signatureB64),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
  } catch {
    valid = false;
  }
  if (!valid) throw invalidToken();

  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    throw invalidToken("Malformed session token.");
  }

  // Required claims: subject, issued-at and expiry must all be present and well-typed.
  if (
    !payload || typeof payload !== "object" || Array.isArray(payload) ||
    typeof payload.sub !== "string" || !payload.sub ||
    !Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)
  ) {
    throw invalidToken();
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw invalidToken("Session expired.", "SESSION_EXPIRED");
  if (payload.iat > now + CLOCK_SKEW_SECONDS) throw invalidToken();

  return payload;
}
