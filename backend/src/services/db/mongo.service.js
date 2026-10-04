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
 * IMPORTANT: Workers can't reuse sockets/I-O objects created in a different
 * request ("Cannot perform I/O on behalf of a different request"). A client
 * cached at module scope works for the first request on an isolate and then
 * hangs/fails later ones, so the client is cached per *request* instead:
 * every handler builds its own `config` object, and we key the client on it.
 */

const clientsByConfig = new WeakMap();

/**
 * @param {{ mongodbUri: string, mongodbDbName: string }} config
 * @returns {Promise<import("mongodb").Db>}
 */
export async function getDb(config) {
  let clientPromise = clientsByConfig.get(config);
  if (!clientPromise) {
    const client = new MongoClient(config.mongodbUri, {
      maxPoolSize: 3,
      // Fail fast with a clear error instead of hanging if Atlas is
      // unreachable (wrong URI, IP not allow-listed, network issue, etc).
      serverSelectionTimeoutMS: 8000,
    });
    clientPromise = client.connect();
    clientsByConfig.set(config, clientPromise);
  }

  try {
    const client = await clientPromise;
    return client.db(config.mongodbDbName);
  } catch (err) {
    clientsByConfig.delete(config);
    const wrapped = new Error(`Failed to connect to MongoDB: ${err.message}`);
    wrapped.status = 503;
    wrapped.code = "DB_CONNECTION_ERROR";
    throw wrapped;
  }
}
