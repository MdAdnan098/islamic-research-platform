import { jsonError } from "../utils/response.js";

/**
 * Wraps a route handler so thrown errors become consistent JSON responses
 * instead of raw Worker exceptions / stack traces leaking to clients.
 *
 * @param {(request: Request, env: object, ctx: object) => Promise<Response>} handler
 */
export function withErrorHandling(handler) {
  return async (request, env, ctx, params) => {
    try {
      return await handler(request, env, ctx, params);
    } catch (err) {
      const isConfigError = err.message?.includes("Missing required environment variable");
      const status = isConfigError ? 500 : err.status || 500;
      const code = isConfigError ? "CONFIG_ERROR" : err.code || "INTERNAL_ERROR";

      console.error("Unhandled error:", err);

      return jsonError(err.message || "Internal server error", {
        status,
        code,
        allowedOrigin: env.ALLOWED_ORIGIN,
      });
    }
  };
}
