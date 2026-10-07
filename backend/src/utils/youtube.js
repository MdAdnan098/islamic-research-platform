/**
 * YouTube URL / id helpers. Pure functions (no network) so they can be
 * unit-tested and shared by the admin form validation and the sync job.
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);

/**
 * Accepts a bare 11-char video id or a YouTube URL (watch?v=, youtu.be/,
 * /live/, /embed/, /shorts/) and returns the video id, or null.
 */
export function extractYouTubeVideoId(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  if (VIDEO_ID_RE.test(value)) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!YT_HOSTS.has(url.hostname.toLowerCase())) return null;

  if (url.hostname.toLowerCase().endsWith("youtu.be")) {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return VIDEO_ID_RE.test(id || "") ? id : null;
  }

  const v = url.searchParams.get("v");
  if (v && VIDEO_ID_RE.test(v)) return v;

  const [kind, id] = url.pathname.split("/").filter(Boolean);
  if (["live", "embed", "shorts", "v"].includes(kind) && VIDEO_ID_RE.test(id || "")) return id;
  return null;
}

export const youtubeWatchUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

/** hqdefault always exists for a video (maxresdefault does not), so it is the safe default. */
export const youtubeThumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

/**
 * Maps a YouTube `videos.list` item (part=snippet,liveStreamingDetails)
 * onto our live-session fields. Returns null for items that are not
 * live broadcasts (ordinary uploads), so the sync never imports those.
 */
export function parseYouTubeVideoResource(item) {
  if (!item || typeof item !== "object" || !item.id) return null;
  const details = item.liveStreamingDetails;
  if (!details) return null;

  const snippet = item.snippet || {};
  const broadcast = snippet.liveBroadcastContent; // "upcoming" | "live" | "none"

  let status;
  if (details.actualEndTime || broadcast === "none") status = "ended";
  else if (details.actualStartTime || broadcast === "live") status = "live";
  else status = "scheduled";

  const toDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const thumbs = snippet.thumbnails || {};
  const best = thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default;

  return {
    youtubeVideoId: item.id,
    title: typeof snippet.title === "string" ? snippet.title : "",
    description: typeof snippet.description === "string" ? snippet.description : "",
    thumbnailUrl: best?.url || youtubeThumbnailUrl(item.id),
    scheduledStartTime: toDate(details.scheduledStartTime),
    actualStartTime: toDate(details.actualStartTime),
    actualEndTime: toDate(details.actualEndTime),
    status,
  };
}
