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
 * Atlas can be slow to answer the very first connection of a cold Worker (or briefly refuse it).
 * One failed attempt used to surface straight away as a 503 to whoever happened to be signing in.
 * Now a failed attempt is retried a couple of times (with a short pause) before giving up, so a
 * momentary hiccup is invisible to the admin. Each attempt still fails fast instead of hanging.
 */
const CONNECT_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 5000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry(config) {
  let lastErr;
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
    const client = new MongoClient(config.mongodbUri, {
      maxPoolSize: 3,
      serverSelectionTimeoutMS: ATTEMPT_TIMEOUT_MS,
      connectTimeoutMS: ATTEMPT_TIMEOUT_MS,
    });
    try {
      return await client.connect();
    } catch (err) {
      lastErr = err;
      try { await client.close(); } catch { /* already closed */ }
      if (attempt < CONNECT_ATTEMPTS) await sleep(300 * attempt);
    }
  }
  throw lastErr;
}

/**
 * @param {{ mongodbUri: string, mongodbDbName: string }} config
 * @returns {Promise<import("mongodb").Db>}
 */
export async function getDb(config) {
  let clientPromise = clientsByConfig.get(config);
  if (!clientPromise) {
    clientPromise = connectWithRetry(config);
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
