/**
 * Tiny per-isolate cache for the public site's shared lookups (categories + folder tree). Every public request
 * used to re-read them from MongoDB (each Worker request opens its own connection, which is the slow part).
 * Entries live 30 s; admin writes on the same isolate clear it at once, other isolates catch up within the TTL.
 */
const TTL_MS = 30_000;
const store = new Map();

export async function cached(key, loader) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await loader();
  store.set(key, { at: Date.now(), value });
  return value;
}

export const invalidatePublicCache = () => store.clear();
