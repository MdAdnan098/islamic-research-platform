/**
 * Reads and validates the Worker's env bindings/vars/secrets in one place,
 * so the rest of the codebase never touches `env` directly.
 *
 * @param {object} env - Cloudflare Worker environment bindings.
 */
export function loadConfig(env) {
  const required = ["MONGODB_URI", "MONGODB_DB_NAME"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Set them via `wrangler secret put` (production) or .dev.vars (local dev)."
    );
  }

  return {
    environment: env.ENVIRONMENT || "development",
    allowedOrigin: env.ALLOWED_ORIGIN || "*",
    mongodbUri: env.MONGODB_URI,
    mongodbDbName: env.MONGODB_DB_NAME,
    adminJwtSecret: env.ADMIN_JWT_SECRET || null,
    adminRegisterKey: env.ADMIN_REGISTER_KEY || null,
    mediaBucket: env.MEDIA_BUCKET || null,
  };
}
