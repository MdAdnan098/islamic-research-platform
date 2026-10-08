import { jsonError } from "../utils/response.js";
import { resolveAllowedOrigin } from "../config/env.js";

/**
 * 5xx codes whose message was written for end users on purpose (payment gateway
 * problems). Every other 5xx message is replaced with a generic one so driver errors,
 * cluster hostnames, binding names or internal details never reach a client.
 */
const SAFE_5XX_CODES = new Set(["PAYMENTS_NOT_CONFIGURED", "PAYMENT_GATEWAY_ERROR"]);

const GENERIC_5XX_MESSAGES = {
  CONFIG_ERROR: "Server configuration error.",
  STORAGE_NOT_CONFIGURED: "Server configuration error.",
  DB_CONNECTION_ERROR: "Service temporarily unavailable. Please try again shortly.",
};

/**
 * Maps any thrown value to the { status, code, message } that is safe to send to a client.
 * Errors we raise on purpose carry a numeric `status`; anything else (MongoDB driver errors,
 * TypeErrors, network failures, ...) is "unexpected" and becomes a plain 500.
 */
export function toPublicError(err) {
  if (err?.message?.includes?.("Missing required environment variable")) {
    return { status: 500, code: "CONFIG_ERROR", message: GENERIC_5XX_MESSAGES.CONFIG_ERROR };
  }

  const deliberate = Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599;
  if (!deliberate) return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." };

  const status = err.status;
  // Only our own upper-snake codes are forwarded (never numeric/driver codes such as 11000 or ECONNRESET).
  const code = typeof err.code === "string" && /^[A-Z][A-Z0-9_]*$/.test(err.code) ? err.code : status >= 500 ? "INTERNAL_ERROR" : `HTTP_${status}`;

  if (status < 500 || SAFE_5XX_CODES.has(code)) {
    return { status, code, message: err.message || "Request failed." };
  }
  return { status, code, message: GENERIC_5XX_MESSAGES[code] || "Internal server error." };
}

/**
 * Wraps a route handler so thrown errors become consistent JSON responses
 * instead of raw Worker exceptions / stack traces leaking to clients.
 * Full details stay in the Worker logs (`wrangler tail`).
 *
 * @param {(request: Request, env: object, ctx: object) => Promise<Response>} handler
 */
export function withErrorHandling(handler) {
  return async (request, env, ctx, params) => {
    try {
      return await handler(request, env, ctx, params);
    } catch (err) {
      const { status, code, message } = toPublicError(err);

      if (status >= 500) {
        console.error("Unhandled error:", err);
      } else {
        // Expected rejections (bad input, 401/403/429): one short line, no stack, no request data.
        console.warn(`Request rejected: ${status} ${code} ${request.method} ${new URL(request.url).pathname}`);
      }

      const headers = err?.retryAfter ? { "Retry-After": String(err.retryAfter) } : undefined;
      return jsonError(message, { status, code, allowedOrigin: resolveAllowedOrigin(env), headers });
    }
  };
}
