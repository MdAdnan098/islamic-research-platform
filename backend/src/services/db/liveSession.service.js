import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { LIVE_STATUSES } from "../../utils/courseEnums.js";
import { parseDateInput } from "../../utils/validate.courses.js";
import { extractYouTubeVideoId, youtubeThumbnailUrl, youtubeWatchUrl } from "../../utils/youtube.js";

/**
 * Data access for the `live_sessions` collection. Metadata only — the
 * video itself always stays on YouTube.
 *
 * Document shape:
 *   { _id, youtubeVideoId, youtubeUrl, title, description, thumbnailUrl,
 *     scheduledStartTime, actualStartTime, actualEndTime, status,
 *     isPublished, syncEnabled, source, lastSyncedAt, createdAt, updatedAt }
 *
 * `source` is "manual" (added in the admin) or "youtube" (discovered by
 * the sync job). `syncEnabled: false` stops the sync from overwriting
 * an admin's manual edits for that session.
 */

const COLLECTION = "live_sessions";

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function getCollection(config) {
  const db = await getDb(config);
  return db.collection(COLLECTION);
}

export async function ensureLiveSessionIndexes(config) {
  const c = await getCollection(config);
  await c.createIndex({ youtubeVideoId: 1 }, { unique: true });
  await c.createIndex({ isPublished: 1, status: 1, scheduledStartTime: -1 });
}

function dateOrNull(value) {
  const d = parseDateInput(value);
  return d === undefined ? null : d;
}

export async function createLiveSession(config, input) {
  const videoId = extractYouTubeVideoId(input.youtubeVideoId ?? input.youtubeUrl);
  const now = new Date();
  const status = LIVE_STATUSES.includes(input.status) ? input.status : "scheduled";

  const doc = {
    youtubeVideoId: videoId,
    youtubeUrl: youtubeWatchUrl(videoId),
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : "Live session",
    description: typeof input.description === "string" ? input.description.trim() : "",
    thumbnailUrl: input.thumbnailUrl || youtubeThumbnailUrl(videoId),
    scheduledStartTime: dateOrNull(input.scheduledStartTime),
    actualStartTime: dateOrNull(input.actualStartTime),
    actualEndTime: dateOrNull(input.actualEndTime),
    status,
    isPublished: input.isPublished === true,
    syncEnabled: input.syncEnabled !== false,
    source: input.source === "youtube" ? "youtube" : "manual",
    lastSyncedAt: input.lastSyncedAt || null,
    createdAt: now,
    updatedAt: now,
  };
  if (status === "live" && !doc.actualStartTime) doc.actualStartTime = now;
  if (status === "ended" && !doc.actualEndTime) doc.actualEndTime = now;

  const c = await getCollection(config);
  try {
    const result = await c.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  } catch (e) {
    if (e.code === 11000) throw fail("A live session for this YouTube video already exists.", 409, "DUPLICATE_VIDEO");
    throw e;
  }
}

export async function findLiveSessionById(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const c = await getCollection(config);
  return c.findOne({ _id: new ObjectId(id) });
}

export async function findLiveSessionByVideoId(config, videoId) {
  const c = await getCollection(config);
  return c.findOne({ youtubeVideoId: videoId });
}

/** @param {{ isPublished?: boolean, status?: string, limit?: number }} filters */
export async function listLiveSessions(config, filters = {}) {
  const c = await getCollection(config);
  const query = {};
  if (typeof filters.isPublished === "boolean") query.isPublished = filters.isPublished;
  if (filters.status && LIVE_STATUSES.includes(filters.status)) query.status = filters.status;
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  return c.find(query).sort({ scheduledStartTime: -1, createdAt: -1 }).limit(limit).toArray();
}

/**
 * A "scheduled" session whose scheduledStartTime has passed is treated as LIVE
 * automatically, so the admin doesn't have to flip it by hand. Only a stored
 * status of "scheduled" is promoted (manual "live"/"ended" always win), it needs
 * no actualEndTime, and it applies for a bounded window so a forgotten session
 * doesn't show LIVE forever. The database is not written; YouTube sync / the
 * admin can still set the real status. Keep AUTO_LIVE_WINDOW_MS in sync with the
 * frontend (components/public/LiveSessions.jsx).
 */
export const AUTO_LIVE_WINDOW_MS = 12 * 60 * 60 * 1000;

export function effectiveStatus(s, now = Date.now()) {
  if (s.status !== "scheduled" || s.actualEndTime) return s.status;
  // No scheduled time at all: it's an already-streamed video, show it as a recording.
  if (!s.scheduledStartTime) return "ended";
  const start = new Date(s.scheduledStartTime).getTime();
  if (!Number.isFinite(start) || start > now) return s.status; // still upcoming
  return now - start <= AUTO_LIVE_WINDOW_MS ? "live" : "ended";
}

/**
 * Display order for the public site: live first, then upcoming (soonest
 * first), then recordings (most recent first).
 */
export function sortForDisplay(sessions) {
  const time = (s) => new Date(s.scheduledStartTime || s.actualStartTime || s.createdAt).getTime();
  const endTime = (s) => new Date(s.actualEndTime || s.actualStartTime || s.scheduledStartTime || s.createdAt).getTime();
  const group = (s) => { const st = effectiveStatus(s); return st === "live" ? 0 : st === "scheduled" ? 1 : 2; };
  return [...sessions].sort((a, b) => {
    const g = group(a) - group(b);
    if (g !== 0) return g;
    if (group(a) === 1) return time(a) - time(b);
    return endTime(b) - endTime(a);
  });
}

export async function updateLiveSession(config, id, updates) {
  const existing = await findLiveSessionById(config, id);
  if (!existing) throw fail("Live session not found.", 404, "NOT_FOUND");

  const $set = { updatedAt: new Date() };
  if (updates.youtubeVideoId !== undefined || updates.youtubeUrl !== undefined) {
    const videoId = extractYouTubeVideoId(updates.youtubeVideoId ?? updates.youtubeUrl);
    $set.youtubeVideoId = videoId;
    $set.youtubeUrl = youtubeWatchUrl(videoId);
    if (updates.thumbnailUrl === undefined && videoId !== existing.youtubeVideoId) $set.thumbnailUrl = youtubeThumbnailUrl(videoId);
  }
  for (const key of ["title", "description"]) {
    if (updates[key] !== undefined) $set[key] = typeof updates[key] === "string" ? updates[key].trim() : "";
  }
  if (updates.thumbnailUrl !== undefined) {
    $set.thumbnailUrl = updates.thumbnailUrl || youtubeThumbnailUrl($set.youtubeVideoId || existing.youtubeVideoId);
  }
  for (const key of ["scheduledStartTime", "actualStartTime", "actualEndTime"]) {
    if (updates[key] !== undefined) $set[key] = dateOrNull(updates[key]);
  }
  for (const key of ["isPublished", "syncEnabled"]) {
    if (updates[key] !== undefined) $set[key] = updates[key];
  }
  if (updates.status !== undefined) {
    $set.status = updates.status;
    const now = new Date();
    if (updates.status === "live" && !existing.actualStartTime && $set.actualStartTime === undefined) $set.actualStartTime = now;
    if (updates.status === "ended" && !existing.actualEndTime && $set.actualEndTime === undefined) $set.actualEndTime = now;
  }

  const c = await getCollection(config);
  try {
    await c.updateOne({ _id: new ObjectId(id) }, { $set });
  } catch (e) {
    if (e.code === 11000) throw fail("A live session for this YouTube video already exists.", 409, "DUPLICATE_VIDEO");
    throw e;
  }
  return findLiveSessionById(config, id);
}

/** Applies fields fetched from YouTube; used only by the sync job. */
export async function applySyncedFields(config, id, fields) {
  const c = await getCollection(config);
  await c.updateOne({ _id: new ObjectId(id) }, { $set: { ...fields, lastSyncedAt: new Date(), updatedAt: new Date() } });
}

export async function deleteLiveSession(config, id) {
  const existing = await findLiveSessionById(config, id);
  if (!existing) throw fail("Live session not found.", 404, "NOT_FOUND");
  const c = await getCollection(config);
  await c.deleteOne({ _id: new ObjectId(id) });
  return { deleted: true };
}

/** Sessions the sync job should refresh: anything not yet ended and flagged for sync. */
export async function listSyncCandidates(config) {
  const c = await getCollection(config);
  return c.find({ status: { $in: ["scheduled", "live"] }, syncEnabled: { $ne: false } }).limit(50).toArray();
}

export function toSafeLiveSession(s) {
  if (!s) return null;
  return {
    id: String(s._id),
    youtubeVideoId: s.youtubeVideoId,
    youtubeUrl: s.youtubeUrl,
    title: s.title,
    description: s.description || "",
    thumbnailUrl: s.thumbnailUrl || youtubeThumbnailUrl(s.youtubeVideoId),
    scheduledStartTime: s.scheduledStartTime || null,
    actualStartTime: s.actualStartTime || null,
    actualEndTime: s.actualEndTime || null,
    status: s.status,
    isPublished: !!s.isPublished,
    syncEnabled: s.syncEnabled !== false,
    source: s.source || "manual",
    lastSyncedAt: s.lastSyncedAt || null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/** Public projection: no admin/sync internals. */
export function toPublicLiveSession(s) {
  const { isPublished, syncEnabled, source, lastSyncedAt, ...rest } = toSafeLiveSession(s);
  return { ...rest, status: effectiveStatus(s) };
}
