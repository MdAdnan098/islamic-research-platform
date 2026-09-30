import { handlePreflight } from "./middleware/cors.js";
import { withErrorHandling } from "./middleware/errorHandler.js";
import { jsonError } from "./utils/response.js";
import { healthCheck } from "./routes/health.routes.js";
import * as publicRoutes from "./routes/public.routes.js";
import * as adminRoutes from "./routes/admin.routes.js";

/**
 * Minimal manual router: no external routing dependency.
 * Each entry is [method, exact pathname, handler].
 * As real endpoints are added (Aqeedah, Masail, Articles, Search, ...),
 * they get their own [method, path, controllerFn] line here.
 */
const routes = [
  ["GET", "/health", healthCheck],
  ["GET", "/api/public/ping", publicRoutes.ping],
  ["POST", "/api/admin/login", adminRoutes.login],
  ["POST", "/api/admin/logout", adminRoutes.logout],
  ["GET", "/api/admin/me", adminRoutes.me],
  ["GET", "/api/admin/ping", adminRoutes.ping],
];

export default {
  async fetch(request, env, ctx) {
    const preflight = handlePreflight(request, env.ALLOWED_ORIGIN);
    if (preflight) return preflight;

    const url = new URL(request.url);
    const match = routes.find(
      ([method, path]) => method === request.method && path === url.pathname
    );

    if (!match) {
      return jsonError("Not found", {
        status: 404,
        code: "NOT_FOUND",
        allowedOrigin: env.ALLOWED_ORIGIN,
      });
    }

    const [, , handler] = match;
    return withErrorHandling(handler)(request, env, ctx);
  },
};
