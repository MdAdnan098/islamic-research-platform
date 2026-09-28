import { loadConfig } from "../config/env.js";
import { getDb } from "../services/db/mongo.service.js";
import { jsonSuccess } from "../utils/response.js";

/**
 * GET /health
 * Verifies the Worker is running and can reach MongoDB.
 */
export async function healthCheck(request, env) {
  const config = loadConfig(env);

  let dbStatus = "unknown";
  try {
    const db = await getDb(config);
    await db.command({ ping: 1 });
    dbStatus = "connected";
  } catch (err) {
    dbStatus = `unavailable: ${err?.message || "unknown error"}`;
  }

  return jsonSuccess(
    {
      status: "ok",
      environment: config.environment,
      database: dbStatus,
      timestamp: new Date().toISOString(),
    },
    { allowedOrigin: config.allowedOrigin }
  );
}
