/**
 * Tiny per-isolate cache for the public site's shared lookups (categories + folder tree). Every public request
 * used to re-read them from MongoDB (each Worker request opens its own connection, which is the slow part).
 * Entries live 30 s; admin writes on the same isolate clear it at once, other isolates catch up within the TTL.
 *
 * If MongoDB is briefly unreachable, the last good copy (up to 10 minutes old) is served instead of an error,
 * so a short database hiccup does not turn into 503 pages for visitors.
 * (Loads are deliberately NOT shared between requests: a Worker promise must not be awaited across requests.)
 */
const TTL_MS = 30_000;
const STALE_OK_MS = 10 * 60_000;
const store = new Map(); // key -> { at, value }

export async function cached(key, loader) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const value = await loader();
    store.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (hit && Date.now() - hit.at < STALE_OK_MS) return hit.value; // serve the last good copy
    throw err;
  }
}

export const invalidatePublicCache = () => { store.clear(); };
