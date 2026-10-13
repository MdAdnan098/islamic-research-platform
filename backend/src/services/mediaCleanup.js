import { getStorage } from "./storage/index.js";

/**
 * Removes media files (R2) that belonged to something that was just deleted (an article, a reference).
 *
 * Media keys are server-generated `<uuid>.<ext>` strings (see media.controller.js) kept as plain strings inside
 * MongoDB documents - there is no separate media collection - so deleting the document removes the Mongo side, and this
 * module removes the file in the bucket. A file is only removed when NO other document still points to it, so an image
 * shared by two posts (or by a reference / folder / course) is never pulled out from under them.
 * Everything here is best-effort: a storage hiccup is logged and never turns a successful delete into an error.
 */
export const MEDIA_KEY_RE = /^[a-f0-9-]{36}\.(jpg|png|webp|gif|pdf)$/;

/** Every media key found anywhere inside the given documents (cover, image / gallery blocks, reference scan, ...). */
export function collectMediaKeys(...docs) {
  const found = new Set();
  const walk = (v) => {
    if (typeof v === "string") { if (MEDIA_KEY_RE.test(v)) found.add(v); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) Object.values(v).forEach(walk);
  };
  docs.forEach(walk);
  return found;
}

/** True when any stored document still uses this key. */
async function stillUsed(config, key) {
  const { getDb } = await import("./db/mongo.service.js");
  const db = await getDb(config);
  const checks = [
    db.collection("articles").findOne({ $or: [{ coverKey: key }, { "blocks.key": key }, { "blocks.pages.key": key }] }, { projection: { _id: 1 } }),
    db.collection("references").findOne({ mediaKey: key }, { projection: { _id: 1 } }),
    db.collection("topics").findOne({ coverKey: key }, { projection: { _id: 1 } }),
    db.collection("courses").findOne({ thumbnailKey: key }, { projection: { _id: 1 } }),
  ];
  return (await Promise.all(checks)).some(Boolean);
}

/**
 * Deletes the unused ones among `keys` from storage. Returns the keys that were removed.
 * `deps` is only for tests: { inUse(key), remove(key) }.
 */
export async function removeUnusedMedia(config, keys, deps = {}) {
  const inUse = deps.inUse || ((k) => stillUsed(config, k));
  const remove = deps.remove || ((k) => getStorage(config).delete(k));
  const removed = [];
  for (const key of keys) {
    try {
      if (await inUse(key)) continue;
      await remove(key);
      removed.push(key);
    } catch (e) {
      console.error(`media cleanup: could not remove ${key}:`, e?.message || e);
    }
  }
  return removed;
}
