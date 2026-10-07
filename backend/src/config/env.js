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
    // Media storage provider: "r2" (default, permanent) or "imagekit" (temporary testing).
    mediaProvider: (env.MEDIA_PROVIDER || "r2").trim().toLowerCase(),
    imagekit: {
      privateKey: env.IMAGEKIT_PRIVATE_KEY || null, // secret — backend only, never sent to the frontend
      urlEndpoint: env.IMAGEKIT_URL_ENDPOINT || null,
      folder: env.IMAGEKIT_FOLDER || "/fahm-e-salaf",
    },
    // YouTube Data API (live-session sync). All optional — without a key the
    // sync is simply disabled and sessions are managed manually in the admin.
    youtube: {
      apiKey: env.YOUTUBE_API_KEY || null, // secret — backend only
      channelId: env.YOUTUBE_CHANNEL_ID || null,
      autoPublish: String(env.YOUTUBE_AUTO_PUBLISH || "").toLowerCase() === "true",
    },
    // Razorpay. All optional — payment endpoints answer 503 until configured.
    razorpay: {
      keyId: env.RAZORPAY_KEY_ID || null, // publishable id, returned to the checkout widget
      keySecret: env.RAZORPAY_KEY_SECRET || null, // secret — never leaves the Worker
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || null, // secret — webhook signature check
    },
  };
}
