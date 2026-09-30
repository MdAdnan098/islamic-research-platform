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

/**
 * @param {string} token
 * @param {string} secret - ADMIN_JWT_SECRET
 * @returns {Promise<object>} decoded payload
 * @throws on invalid signature, malformed token, or expiry
 */
export async function verifyJwt(token, secret) {
  if (typeof token !== "string" || token.split(".").length !== 3) {
    const err = new Error("Malformed session token.");
    err.status = 401;
    err.code = "INVALID_TOKEN";
    throw err;
  }

  const [headerB64, payloadB64, signatureB64] = token.split(".");
  const data = `${headerB64}.${payloadB64}`;
  const key = await importHmacKey(secret);

  const valid = await crypto.subtle.verify("HMAC", key, base64UrlDecodeToBuffer(signatureB64), encoder.encode(data));

  if (!valid) {
    const err = new Error("Invalid session token.");
    err.status = 401;
    err.code = "INVALID_TOKEN";
    throw err;
  }

  const payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.exp === "number" && payload.exp < now) {
    const err = new Error("Session expired.");
    err.status = 401;
    err.code = "SESSION_EXPIRED";
    throw err;
  }

  return payload;
}
