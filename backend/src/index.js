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
import { routes as publicLiveRoutes } from "./routes/public.live.routes.js";
import { routes as adminLiveRoutes } from "./routes/admin.live.routes.js";
import { routes as publicCourseRoutes } from "./routes/public.courses.routes.js";
import { routes as adminCourseRoutes } from "./routes/admin.courses.routes.js";
import { routes as publicPaymentRoutes } from "./routes/public.payments.routes.js";
import { routes as adminEnrollmentRoutes } from "./routes/admin.enrollments.routes.js";
import { runScheduledSync } from "./services/youtube/youtube.service.js";
import { archiveExpiredCourses } from "./services/db/course.service.js";
import { loadConfig, resolveAllowedOrigin } from "./config/env.js";
import { requireAdmin } from "./middleware/adminAuth.js";

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
  ...publicLiveRoutes,
  ...adminLiveRoutes,
  ...publicCourseRoutes,
  ...adminCourseRoutes,
  ...publicPaymentRoutes,
  ...adminEnrollmentRoutes,
];

const router = buildRouter(routeDefs);

/**
 * Admin endpoints that must work WITHOUT a session (they carry their own checks).
 * Every OTHER /api/admin/* route is authenticated here, in front of its controller,
 * so a controller that forgets to call requireAdmin can never be reached anonymously.
 */
const ADMIN_OPEN_PATHS = new Set([
  "/api/admin/login",
  "/api/admin/logout",
  "/api/admin/register",
  "/api/admin/reset-password",
]);

function guardAdmin(pathname, handler) {
  if (!pathname.startsWith("/api/admin/") || ADMIN_OPEN_PATHS.has(pathname)) return handler;
  return async (request, env, ctx, params) => {
    await requireAdmin(request, env);
    return handler(request, env, ctx, params);
  };
}

/**
 * Non-breaking security headers for every response. CSP / frame protection are limited to
 * JSON responses: media (images / PDFs) is embedded by the site, so it only gets the
 * content-type and referrer headers.
 */
function withSecurityHeaders(request, response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  if (new URL(request.url).protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000");
  if ((headers.get("Content-Type") || "").startsWith("application/json")) {
    headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    headers.set("X-Frame-Options", "DENY");
  }
  // Authenticated responses must never be stored by browsers or shared caches.
  if (pathname.startsWith("/api/admin/") && !headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handle(request, env, ctx) {
  const allowedOrigin = resolveAllowedOrigin(env);

  const preflight = handlePreflight(request, allowedOrigin);
  if (preflight) return preflight;

  const url = new URL(request.url);
  const match = router.match(request.method, url.pathname);

  if (!match) {
    return jsonError("Not found", { status: 404, code: "NOT_FOUND", allowedOrigin });
  }

  return withErrorHandling(guardAdmin(url.pathname, match.handler))(request, env, ctx, match.params);
}

export default {
  async fetch(request, env, ctx) {
    const response = await handle(request, env, ctx);
    return withSecurityHeaders(request, response, new URL(request.url).pathname);
  },

  /**
   * Cron Trigger entry point (YouTube live-session sync + persisting course cleanup). Only runs if a
   * cron is configured in wrangler.toml / the dashboard. The YouTube part does nothing unless
   * YOUTUBE_API_KEY is set.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledSync(env));
    // Course cleanup is persistence only (public queries already hide expired courses by timestamp).
    ctx.waitUntil(
      (async () => {
        try { await archiveExpiredCourses(loadConfig(env)); } catch (err) { console.error("Course cleanup failed:", err.message); }
      })()
    );
  },
};
