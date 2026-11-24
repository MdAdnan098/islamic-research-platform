import { dispatchNotification, isPushConfigured } from "./dispatcher.js";
import { getAutoSettings, hasNotificationKey } from "../db/push.service.js";
import { listLiveSessions, effectiveStatus } from "../db/liveSession.service.js";
import { clip } from "../../utils/push.js";

/**
 * Automatic notifications (Phase 3). Each function is called by the code that publishes something, AFTER the database write
 * succeeded, and is safe to call at any time:
 *  - it never throws (a push problem must never undo or block a publish),
 *  - it does nothing when push is not configured or the admin switched that event off,
 *  - it is idempotent: every event has a dedupeKey (`post:<id>`, `course:<id>`, `live-new:<id>`, `live-start:<id>`), so
 *    unpublishing and publishing again, editing a published item, or a retried request can never notify twice.
 * The link of every notification uses the website's existing routes (/article/:slug, /courses/:slug, /live).
 */

async function run(config, settingKey, build, deps) {
  try {
    if (!isPushConfigured(config)) return { skipped: "not_configured" };
    const settings = await getAutoSettings(config);
    if (settings[settingKey] === false) return { skipped: "switched_off" };
    const input = { ...build(), source: "auto", createdBy: "system" };
    const out = await dispatchNotification(config, input, deps);
    return out.duplicate ? { skipped: "duplicate" } : { sent: true, id: out.notification?.id };
  } catch (err) {
    console.error("Push event failed:", err?.code || err?.message);
    return { skipped: "error" };
  }
}

const BOTH = ["android", "web"];

/** A post that has just gone from not-published to published. */
export function notifyArticlePublished(config, article, deps) {
  return run(config, "posts", () => ({
    title: clip(article.title || "Naya mazmoon", 100),
    body: clip(article.excerpt || "Naya mazmoon shaya hua hai. Parhne ke liye tap karein.", 140),
    category: "posts",
    link: `/article/${encodeURIComponent(article.slug)}`,
    platforms: BOTH,
    kind: "post",
    dedupeKey: `post:${article._id}`,
  }), deps);
}

/** A course that is now published (and not a draft / archived one). */
export function notifyCoursePublished(config, course, deps) {
  return run(config, "courses", () => ({
    title: clip(`Naya course: ${course.title}`, 100),
    body: clip(course.shortDescription || "Naya course shuru hua hai. Tafseel ke liye tap karein.", 140),
    category: "courses",
    link: `/courses/${encodeURIComponent(course.slug)}`,
    platforms: BOTH,
    kind: "course",
    dedupeKey: `course:${course._id}`,
  }), deps);
}

/** A newly published live session that has not started yet. */
export function notifyLiveScheduled(config, session, deps) {
  return run(config, "liveNew", () => ({
    title: "Naya live session",
    body: clip(session.title || "Naya live session shaamil kiya gaya hai.", 140),
    category: "live",
    link: "/live",
    platforms: BOTH,
    kind: "liveNew",
    dedupeKey: `live-new:${session._id}`,
  }), deps);
}

/** A published live session that is live right now. */
export function notifyLiveStarted(config, session, deps) {
  return run(config, "liveStart", () => ({
    title: "Live shuru ho gaya hai",
    body: clip(session.title || "AthariTV par live session shuru ho gaya hai.", 140),
    category: "live",
    link: "/live",
    platforms: BOTH,
    kind: "liveStart",
    dedupeKey: `live-start:${session._id}`,
  }), deps);
}

/**
 * Called after a session was created / edited / synced from YouTube. Decides which (if any) event it is:
 *  published + live now                         -> "live is starting"
 *  published + upcoming, was not published before -> "new live session"
 *  anything else (recording, draft, unchanged)   -> nothing
 */
export async function notifyLiveChange(config, before, after, deps) {
  try {
    if (!after || !after.isPublished) return { skipped: "not_published" };
    const wasLive = before && before.isPublished && before.status === "live";
    if (after.status === "live" && !wasLive) return await notifyLiveStarted(config, after, deps);
    const wasPublished = !!(before && before.isPublished);
    if (!wasPublished && after.status === "scheduled") return await notifyLiveScheduled(config, after, deps);
    return { skipped: "no_event" };
  } catch (err) {
    console.error("Push live event failed:", err?.code || err?.message);
    return { skipped: "error" };
  }
}

/** A session that started this long ago is history: never announce it as "starting" (e.g. right after the feature is enabled). */
export const LIVE_START_WINDOW_MS = 30 * 60 * 1000;

/**
 * Cron: a session whose scheduled time has arrived is shown as LIVE by the website without any database write, so no
 * publish / edit ever runs for it. This picks those up (published, scheduled time reached within the last 30 minutes,
 * not announced yet). Runs only if a cron trigger is configured.
 */
export async function sweepLiveStarts(config, deps = {}) {
  try {
    if (!isPushConfigured(config)) return { sent: 0 };
    const now = deps.now ? deps.now().getTime() : Date.now();
    const sessions = await listLiveSessions(config, { isPublished: true, limit: 200 });
    let sent = 0;
    for (const s of sessions) {
      if (effectiveStatus(s, now) !== "live") continue;
      const startedAt = new Date(s.actualStartTime || s.scheduledStartTime || 0).getTime();
      if (!Number.isFinite(startedAt) || now - startedAt > LIVE_START_WINDOW_MS) continue;
      if (await hasNotificationKey(config, `live-start:${s._id}`)) continue;
      const result = await notifyLiveStarted(config, s, deps);
      if (result.sent) sent += 1;
    }
    return { sent };
  } catch (err) {
    console.error("Push live sweep failed:", err?.code || err?.message);
    return { sent: 0 };
  }
}
