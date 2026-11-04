import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { getDashboardCounts } from "../services/db/dashboard.service.js";

/** GET /api/admin/dashboard-stats - read-only counts of enrollments, payments and live sessions. */
export async function stats(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  return jsonSuccess({ stats: await getDashboardCounts(config) }, { allowedOrigin: config.allowedOrigin });
}
