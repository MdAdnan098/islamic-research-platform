/**
 * Password hashing using the Web Crypto API (PBKDF2 / SHA-256), which is
 * natively available in the Workers runtime — no bcrypt/argon2 dependency
 * needed (those rely on Node native bindings Workers doesn't support).
 *
 * Stored format: "pbkdf2$<iterations>$<saltBase64>$<hashBase64>"
 * so the iteration count and salt travel with the hash and can be
 * upgraded later without invalidating existing hashes.
 */

const PBKDF2_ITERATIONS = 100_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;

const encoder = new TextEncoder();

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveBits(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    HASH_BITS
  );
}

/** Constant-time string comparison to avoid timing side-channels. */
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Constant-time comparison of two secrets of ANY length. Both values are hashed
 * with SHA-256 first, so the comparison always runs over two 32-byte digests and
 * neither the content nor the length of the real secret leaks through timing.
 */
export async function secretsEqual(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/**
 * Well-formed hash of a throwaway password. The login route verifies against it
 * when the username does not exist, so "unknown user" and "wrong password" cost the
 * same PBKDF2 work and cannot be told apart by response time.
 */
export const DUMMY_PASSWORD_HASH =
  "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/**
 * @param {string} password - plaintext password
 * @returns {Promise<string>} encoded hash, safe to store in MongoDB
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufferToBase64(salt.buffer)}$${bufferToBase64(bits)}`;
}

/**
 * @param {string} password - plaintext password from the login request
 * @param {string} storedHash - value from admins.passwordHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") return false;

  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const [, iterationsRaw, saltB64, expectedHashB64] = parts;
  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const salt = base64ToBuffer(saltB64);
  const bits = await deriveBits(password, salt, iterations);
  const actualHashB64 = bufferToBase64(bits);

  return timingSafeEqual(actualHashB64, expectedHashB64);
}
