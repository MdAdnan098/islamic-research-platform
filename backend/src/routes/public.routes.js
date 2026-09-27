import { loadConfig } from "../config/env.js";
import { jsonSuccess } from "../utils/response.js";

/**
 * Public API routes (no authentication).
 * Aqeedah / Masail / Categories / Articles / Search endpoints will be
 * added here in a later phase, backed by their own controllers.
 */

/**
 * GET /api/public/ping
 * Simple placeholder confirming the public API namespace is wired up.
 */
export async function ping(request, env) {
  const config = loadConfig(env);
  return jsonSuccess({ message: "Public API is reachable." }, { allowedOrigin: config.allowedOrigin });
}
