import { handlePreflight } from "./middleware/cors.js";
import { withErrorHandling } from "./middleware/errorHandler.js";
import { jsonError } from "./utils/response.js";
import { buildRouter } from "./utils/router.js";
import { healthCheck } from "./routes/health.routes.js";
import * as publicRoutes from "./routes/public.routes.js";
import * as adminRoutes from "./routes/admin.routes.js";
import { routes as adminCategoryRoutes } from "./routes/admin.categories.routes.js";
import { routes as adminTopicRoutes } from "./routes/admin.topics.routes.js";
import { routes as adminArticleRoutes } from "./routes/admin.articles.routes.js";
import { routes as adminReferenceRoutes } from "./routes/admin.references.routes.js";
import { routes as mediaRoutes } from "./routes/media.routes.js";
import { routes as publicContentRoutes } from "./routes/public.content.routes.js";

/**
 * Route table: [method, pattern, handler]. Patterns support ":param"
 * segments (see utils/router.js) and are compiled once below, not per
 * request. Order matters where a literal segment could collide with a
 * ":param" on the same position (e.g. "/categories/reorder" must be
 * listed before "/categories/:id") — each *.routes.js file already
 * orders its own entries correctly; this list just concatenates them.
 */
const routeDefs = [
  ["GET", "/health", healthCheck],
  ["GET", "/api/public/ping", publicRoutes.ping],
  ["POST", "/api/admin/login", adminRoutes.login],
  ["POST", "/api/admin/logout", adminRoutes.logout],
  ["POST", "/api/admin/register", adminRoutes.register],
  ["POST", "/api/admin/reset-password", adminRoutes.resetPassword],
  ["GET", "/api/admin/me", adminRoutes.me],
  ["GET", "/api/admin/ping", adminRoutes.ping],
  ...adminCategoryRoutes,
  ...adminTopicRoutes,
  ...adminArticleRoutes,
  ...adminReferenceRoutes,
  ...publicContentRoutes,
  ...mediaRoutes,
];

const router = buildRouter(routeDefs);

export default {
  async fetch(request, env, ctx) {
    const preflight = handlePreflight(request, env.ALLOWED_ORIGIN);
    if (preflight) return preflight;

    const url = new URL(request.url);
    const match = router.match(request.method, url.pathname);

    if (!match) {
      return jsonError("Not found", {
        status: 404,
        code: "NOT_FOUND",
        allowedOrigin: env.ALLOWED_ORIGIN,
      });
    }

    return withErrorHandling(match.handler)(request, env, ctx, match.params);
  },
};
