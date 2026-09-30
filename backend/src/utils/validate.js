/**
 * Small, dependency-free validators for admin auth request bodies.
 * These check structural validity only (right shape/type/length) — they
 * intentionally never reveal whether a given email actually exists.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @returns {string[]} list of validation errors (empty = valid) */
export function validateLoginInput(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    return ["Request body must be a JSON object."];
  }

  const { email, password } = body;

  if (typeof email !== "string" || email.trim().length === 0) {
    errors.push("Email is required.");
  } else if (email.length > 254 || !EMAIL_RE.test(email.trim())) {
    errors.push("Email must be a valid email address.");
  }

  if (typeof password !== "string" || password.length === 0) {
    errors.push("Password is required.");
  } else if (password.length > 256) {
    errors.push("Password is too long.");
  }

  return errors;
}

/** Safely parses a request body as JSON, returning null on failure. */
export async function safeParseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
