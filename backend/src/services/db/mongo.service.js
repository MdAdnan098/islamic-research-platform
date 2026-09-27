import { MongoClient } from "mongodb";

/**
 * MongoDB Atlas connection service.
 *
 * Uses the official `mongodb` Node.js driver directly, running on Cloudflare
 * Workers via the `nodejs_compat` compatibility flag (enabled in
 * wrangler.toml), which provides the TCP sockets the driver needs.
 *
 * Note: MongoDB Atlas's old Data API (HTTPS-based) is deprecated/retired,
 * so it is intentionally not used here. This driver-based approach is
 * Cloudflare's currently recommended way to reach MongoDB from a Worker.
 *
 * The client is cached at module scope so warm isolates reuse the same
 * connection pool instead of reconnecting on every request.
 */

let cachedClientPromise = null;

/**
 * @param {{ mongodbUri: string, mongodbDbName: string }} config
 * @returns {Promise<import("mongodb").Db>}
 */
export async function getDb(config) {
  if (!cachedClientPromise) {
    const client = new MongoClient(config.mongodbUri, {
      // Workers isolates are short-lived; keep the pool small.
      maxPoolSize: 5,
      // Fail fast with a clear error instead of hanging if Atlas is
      // unreachable (wrong URI, IP not allow-listed, network issue, etc).
      serverSelectionTimeoutMS: 8000,
    });
    cachedClientPromise = client.connect();
  }

  try {
    const client = await cachedClientPromise;
    return client.db(config.mongodbDbName);
  } catch (err) {
    // Reset the cache so the next request attempts a fresh connection
    // instead of permanently reusing a failed one.
    cachedClientPromise = null;
    const wrapped = new Error(`Failed to connect to MongoDB: ${err.message}`);
    wrapped.status = 503;
    wrapped.code = "DB_CONNECTION_ERROR";
    throw wrapped;
  }
}
