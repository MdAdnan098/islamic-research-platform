import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { CATEGORIES, PLATFORMS, defaultPrefs, normalizePrefs } from "../../utils/push.js";

/**
 * Data access for push notifications (Phase 3). Three collections:
 *
 *  push_devices        one document per device token (Android FCM token or website FCM token):
 *                      { _id, platform, token, installId|null, prefs:{enabled,posts,courses,live,announcements},
 *                        createdAt, lastSeenAt }
 *                      No name, e-mail, phone, IP address or browser fingerprint is stored. Tokens are never returned by any API.
 *  push_notifications  history + progress of every notification:
 *                      { _id, title, body, category, link, platforms, source, kind, dedupeKey|null, status, targeted, counts,
 *                        cursor, leaseUntil, createdAt, completedAt, createdBy }
 *  push_settings       one document { _id: "auto", posts, courses, liveNew, liveStart } - which automatic events are on.
 */

const DEVICES = "push_devices";
const NOTIFICATIONS = "push_notifications";
const SETTINGS = "push_settings";
const SETTINGS_ID = "auto";

async function col(config, name) {
  const db = await getDb(config);
  return db.collection(name);
}

export async function ensurePushIndexes(config) {
  const devices = await col(config, DEVICES);
  await devices.createIndex({ token: 1 }, { unique: true });
  await devices.createIndex({ installId: 1, platform: 1 });
  await devices.createIndex({ platform: 1, "prefs.enabled": 1 });
  const notes = await col(config, NOTIFICATIONS);
  // Partial unique index: only notifications that have a dedupeKey are limited to one per key.
  await notes.createIndex({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
  await notes.createIndex({ createdAt: -1 });
  await notes.createIndex({ status: 1, leaseUntil: 1 });
}

/* ------------------------------- devices ------------------------------- */

/**
 * Registers a device, or refreshes it when the same token comes back (every app start / page load).
 * Token refresh: when an installId already had a DIFFERENT token on this platform, that old token is removed and its
 * preferences carry over, so one install is never counted (or notified) twice.
 * @returns {{ created: boolean, prefs: object }}
 */
export async function registerDevice(config, { platform, token, installId, prefs }) {
  const c = await col(config, DEVICES);
  const now = new Date();
  const existing = await c.findOne({ token });
  let base = existing?.prefs || null;

  if (installId) {
    const stale = await c.find({ installId, platform, token: { $ne: token } }).limit(20).toArray();
    if (stale.length) {
      base ||= stale[0].prefs || null;
      await c.deleteMany({ _id: { $in: stale.map((d) => d._id) } });
    }
  }

  const nextPrefs = prefs ? normalizePrefs(prefs) : normalizePrefs(null, base || defaultPrefs());
  await c.updateOne(
    { token },
    { $set: { platform, installId: installId || null, prefs: nextPrefs, lastSeenAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  return { created: !existing, prefs: nextPrefs };
}

export async function updateDevicePrefs(config, token, prefs) {
  const c = await col(config, DEVICES);
  const existing = await c.findOne({ token });
  if (!existing) return null;
  const next = normalizePrefs(prefs, existing.prefs || defaultPrefs());
  await c.updateOne({ _id: existing._id }, { $set: { prefs: next, lastSeenAt: new Date() } });
  return next;
}

export async function findDevicePrefs(config, token) {
  const c = await col(config, DEVICES);
  const d = await c.findOne({ token });
  return d ? normalizePrefs(null, d.prefs || defaultPrefs()) : null;
}

export async function removeDeviceByToken(config, token) {
  const c = await col(config, DEVICES);
  const res = await c.deleteOne({ token });
  return (res?.deletedCount || 0) > 0;
}

export async function deleteDevicesByIds(config, ids) {
  if (!ids.length) return 0;
  const c = await col(config, DEVICES);
  const res = await c.deleteMany({ _id: { $in: ids } });
  return res?.deletedCount || 0;
}

/** Devices that would receive a notification of `category` on `platforms` (the same filter the sender uses). */
function recipientFilter(platforms, category) {
  const filter = { platform: { $in: platforms.filter((p) => PLATFORMS.includes(p)) }, "prefs.enabled": { $ne: false } };
  if (CATEGORIES.includes(category)) filter[`prefs.${category}`] = { $ne: false };
  return filter;
}

export async function countRecipients(config, platforms, category) {
  const c = await col(config, DEVICES);
  const out = { android: 0, web: 0 };
  for (const platform of platforms) {
    if (PLATFORMS.includes(platform)) out[platform] = await c.countDocuments(recipientFilter([platform], category));
  }
  return out;
}

/** Next page of recipients after `cursorId` (null = from the start), oldest first. */
export async function listRecipientsAfter(config, platforms, category, cursorId, limit) {
  const c = await col(config, DEVICES);
  const filter = recipientFilter(platforms, category);
  if (cursorId) filter._id = { $gt: cursorId };
  return c.find(filter).sort({ _id: 1 }).limit(limit).toArray();
}

export async function countDevices(config) {
  const c = await col(config, DEVICES);
  return { android: await c.countDocuments({ platform: "android" }), web: await c.countDocuments({ platform: "web" }) };
}

/* ---------------------------- notifications ---------------------------- */

/**
 * Creates the notification record. With a dedupeKey this is an atomic "insert if not there yet": the second caller gets
 * { created: false } and must not send. Without a key it is a plain insert.
 */
export async function claimNotification(config, doc) {
  const c = await col(config, NOTIFICATIONS);
  if (!doc.dedupeKey) {
    const res = await c.insertOne(doc);
    return { created: true, id: res.insertedId };
  }
  const { dedupeKey, ...rest } = doc;
  const res = await c.updateOne({ dedupeKey }, { $setOnInsert: rest }, { upsert: true });
  if (res.upsertedId) return { created: true, id: res.upsertedId };
  return { created: false, id: null };
}

export async function findNotification(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const c = await col(config, NOTIFICATIONS);
  return c.findOne({ _id: new ObjectId(id) });
}

export async function hasNotificationKey(config, dedupeKey) {
  const c = await col(config, NOTIFICATIONS);
  return !!(await c.findOne({ dedupeKey }));
}

/** Takes the 60 s "lease" on a notification so two requests can never send the same chunk. */
export async function leaseNotification(config, id, now = new Date(), leaseMs = 60_000) {
  const c = await col(config, NOTIFICATIONS);
  const res = await c.updateOne(
    { _id: id, status: { $in: ["queued", "sending"] }, $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }] },
    { $set: { status: "sending", leaseUntil: new Date(now.getTime() + leaseMs) } }
  );
  return (res?.matchedCount || 0) > 0;
}

export async function finishChunk(config, id, { cursor, inc, status, completedAt, lastError }) {
  const c = await col(config, NOTIFICATIONS);
  const $set = { cursor: cursor || null, leaseUntil: null, status };
  if (completedAt) $set.completedAt = completedAt;
  if (lastError !== undefined) $set.lastError = lastError;
  await c.updateOne({ _id: id }, { $set, $inc: inc });
}

export async function listNotifications(config, limit = 50) {
  const c = await col(config, NOTIFICATIONS);
  return c.find({}).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 100)).toArray();
}

/** Notifications that still have devices left to try (used by the optional cron and the admin "continue"). */
export async function listUnfinished(config, now = new Date(), limit = 3) {
  const c = await col(config, NOTIFICATIONS);
  return c.find({ status: { $in: ["queued", "sending"] }, $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }] }).sort({ createdAt: 1 }).limit(limit).toArray();
}

/** Admin-facing shape. Contains no device token and no credential. */
export function toAdminNotification(n) {
  if (!n) return null;
  const counts = n.counts || {};
  const per = (p) => ({ sent: counts[p]?.sent || 0, failed: counts[p]?.failed || 0 });
  return {
    id: String(n._id),
    title: n.title,
    body: n.body,
    category: n.category,
    link: n.link || "",
    platforms: n.platforms || [],
    source: n.source || "custom",
    kind: n.kind || "custom",
    status: n.status,
    targeted: { android: n.targeted?.android || 0, web: n.targeted?.web || 0 },
    sent: (counts.android?.sent || 0) + (counts.web?.sent || 0),
    failed: (counts.android?.failed || 0) + (counts.web?.failed || 0),
    removed: counts.removed || 0,
    byPlatform: { android: per("android"), web: per("web") },
    lastError: n.lastError || "",
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : null,
    completedAt: n.completedAt instanceof Date ? n.completedAt.toISOString() : null,
    createdBy: n.createdBy || "",
  };
}

/* ------------------------------- settings ------------------------------- */

export const DEFAULT_AUTO = { posts: true, courses: true, liveNew: true, liveStart: true };

export async function getAutoSettings(config) {
  const c = await col(config, SETTINGS);
  const doc = await c.findOne({ _id: SETTINGS_ID });
  const out = { ...DEFAULT_AUTO };
  for (const key of Object.keys(DEFAULT_AUTO)) if (typeof doc?.[key] === "boolean") out[key] = doc[key];
  return out;
}

export async function saveAutoSettings(config, value) {
  const c = await col(config, SETTINGS);
  await c.updateOne({ _id: SETTINGS_ID }, { $set: { ...value, updatedAt: new Date() } }, { upsert: true });
  return getAutoSettings(config);
}
