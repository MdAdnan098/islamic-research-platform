import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";

/**
 * Admin API routes (authenticated).
 * Content management endpoints (create/edit/publish for Aqeedah, Masail,
 * Categories, Articles) will be added here once the content architecture
 * is built, each guarded by requireAdmin.
 */

/**
 * GET /api/admin/ping
 * Placeholder confirming the admin namespace + auth gate are wired up.
 * Currently always rejects, since admin auth is not implemented yet.
 */
export async function ping(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env); // will throw 401/501 until auth exists
  return jsonSuccess({ message: "Admin API is reachable." }, { allowedOrigin: config.allowedOrigin });
}
