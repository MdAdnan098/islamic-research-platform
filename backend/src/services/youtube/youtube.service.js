import { loadConfig } from "../../config/env.js";
import { parseYouTubeVideoResource } from "../../utils/youtube.js";
import {
  listSyncCandidates,
  findLiveSessionByVideoId,
  createLiveSession,
  applySyncedFields,
} from "../db/liveSession.service.js";

/**
 * YouTube Data API v3 → MongoDB synchronisation (server side only).
 *
 *   YouTube → this Worker → MongoDB → frontend
 *
 * The API key (YOUTUBE_API_KEY) is a Worker secret and is never sent to
 * the browser. Without it every function here is a safe no-op.
 *
 * Quota (default 10,000 units/day): videos.list costs 1 unit per call and
 * is used to refresh known sessions (up to 50 per call). search.list costs
 * 100 units and is only used for discovery, which the scheduled job runs
 * about once an hour (see runScheduledSync).
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";
const TIMEOUT_MS = 10_000;

export const isYouTubeConfigured = (config) => !!config.youtube?.apiKey;

async function ytFetch(config, endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", config.youtube.apiKey);

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new Error("YouTube API request failed (network).");
  }
  if (!res.ok) {
    let reason = "";
    try { reason = (await res.json())?.error?.errors?.[0]?.reason || ""; } catch { /* ignore */ }
    // The request URL contains the key, so it is deliberately NOT logged or included in the error.
    throw new Error(`YouTube API error ${res.status}${reason ? ` (${reason})` : ""}.`);
  }
  return res.json();
}

/** Fetches live-streaming details for up to 50 video ids. */
export async function fetchVideos(config, ids) {
  if (ids.length === 0) return [];
  const data = await ytFetch(config, "videos", { part: "snippet,liveStreamingDetails", id: ids.slice(0, 50).join(",") });
  return (data.items || []).map(parseYouTubeVideoResource).filter(Boolean);
}

/** Finds currently-live / upcoming broadcasts on the configured channel (100 quota units per call). */
export async function discoverChannelVideoIds(config, eventType) {
  if (!config.youtube.channelId) return [];
  const data = await ytFetch(config, "search", {
    part: "id",
    channelId: config.youtube.channelId,
    type: "video",
    eventType,
    maxResults: "10",
  });
  return (data.items || []).map((i) => i.id?.videoId).filter(Boolean);
}

/**
 * @param {object} config
 * @param {{ discover?: boolean }} [opts] discover=true also looks for new live/upcoming broadcasts on the channel
 * @returns {Promise<{ configured: boolean, refreshed: number, created: number, discovered: number, error?: string }>}
 */
export async function syncLiveSessions(config, { discover = false } = {}) {
  if (!isYouTubeConfigured(config)) return { configured: false, refreshed: 0, created: 0, discovered: 0 };

  const summary = { configured: true, refreshed: 0, created: 0, discovered: 0 };
  try {
    // 1) Refresh sessions we already know about (cheap: 1 unit for the whole batch).
    const candidates = await listSyncCandidates(config);
    if (candidates.length > 0) {
      const fresh = await fetchVideos(config, candidates.map((s) => s.youtubeVideoId));
      const byId = new Map(fresh.map((v) => [v.youtubeVideoId, v]));
      for (const session of candidates) {
        const v = byId.get(session.youtubeVideoId);
        if (!v) continue; // private/deleted video — leave as is; admin can unpublish
        await applySyncedFields(config, session._id, {
          title: v.title || session.title,
          thumbnailUrl: v.thumbnailUrl,
          scheduledStartTime: v.scheduledStartTime,
          actualStartTime: v.actualStartTime,
          actualEndTime: v.actualEndTime,
          status: v.status,
        });
        summary.refreshed += 1;
      }
    }

    // 2) Optionally discover new broadcasts on the channel.
    if (discover && config.youtube.channelId) {
      const ids = new Set();
      for (const eventType of ["live", "upcoming"]) {
        for (const id of await discoverChannelVideoIds(config, eventType)) ids.add(id);
      }
      const newIds = [];
      for (const id of ids) if (!(await findLiveSessionByVideoId(config, id))) newIds.push(id);
      summary.discovered = newIds.length;

      for (const v of await fetchVideos(config, newIds)) {
        await createLiveSession(config, {
          youtubeVideoId: v.youtubeVideoId,
          title: v.title,
          description: v.description,
          thumbnailUrl: v.thumbnailUrl,
          scheduledStartTime: v.scheduledStartTime,
          actualStartTime: v.actualStartTime,
          actualEndTime: v.actualEndTime,
          status: v.status,
          // New channel broadcasts stay hidden until an admin publishes them,
          // unless YOUTUBE_AUTO_PUBLISH=true is set.
          isPublished: config.youtube.autoPublish,
          source: "youtube",
          lastSyncedAt: new Date(),
        });
        summary.created += 1;
      }
    }
  } catch (err) {
    summary.error = err.message;
  }
  return summary;
}

/**
 * Cron entry point. Never throws (a failed sync must not break the Worker).
 * Refreshes known sessions on every run; runs the quota-heavy channel
 * discovery only in the first 15 minutes of each hour, so a every-10-minutes
 * cron schedule costs roughly 2 × 100 units/hour for discovery plus a few units
 * for refreshes — comfortably inside the default 10,000 units/day.
 */
export async function runScheduledSync(env, now = new Date()) {
  try {
    const config = loadConfig(env);
    if (!isYouTubeConfigured(config)) return;
    const summary = await syncLiveSessions(config, { discover: now.getUTCMinutes() < 15 });
    if (summary.error) console.error("YouTube sync problem:", summary.error);
  } catch (err) {
    console.error("YouTube scheduled sync failed:", err.message);
  }
}
