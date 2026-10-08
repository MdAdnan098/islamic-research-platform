/**
 * IST helpers for the course system. Course timing is ALWAYS shown / entered in Asia/Kolkata, whatever the
 * device's own timezone is. (India has no DST, so the +05:30 offset is fixed.)
 */
export const IST_TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;

const fmt = (opts) => new Intl.DateTimeFormat("en-IN", { timeZone: IST_TZ, ...opts });
const DATE_TIME = fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
const DATE = fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
const TIME = fmt({ hour: "numeric", minute: "2-digit", hour12: true });

const safe = (f, v, suffix = "") => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : `${f.format(d)}${suffix}`;
};
export const formatIstDateTime = (v) => safe(DATE_TIME, v, " IST");
export const formatIstDate = (v) => safe(DATE, v);
export const formatIstTime = (v) => safe(TIME, v);

/** Absolute instant -> "YYYY-MM-DDTHH:mm" in IST (value for <input type="datetime-local">). */
export function toIstInput(v) {
  if (!v) return "";
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? "" : new Date(t + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DD" + n calendar days -> "YYYY-MM-DD" (pure calendar arithmetic, no timezone involved). */
export function addDaysToDateString(dateStr, n) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Remaining milliseconds -> "2d 3h 10m" / "1h 05m 09s" / "42s". Display only. */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${h}h ${p(m)}m`;
  if (h > 0) return `${h}h ${p(m)}m ${p(s)}s`;
  if (m > 0) return `${m}m ${p(s)}s`;
  return `${s}s`;
}

/**
 * Display-only status of the class days from the authoritative timestamps (same comparisons the server makes:
 * live while startsAt <= now < endsAt). The server snapshot is re-fetched at every transition, so this only
 * keeps the screen current between fetches.
 */
export function deriveSchedule(sessions = [], now) {
  const days = sessions.map((s, i) => {
    const start = Date.parse(s.startsAt);
    const end = Date.parse(s.endsAt);
    return { ...s, day: s.day || i + 1, start, end, status: now >= end ? "completed" : now >= start ? "live" : "upcoming" };
  });
  if (days.length === 0) return { phase: "unscheduled", label: null, badge: null, days, next: null };
  const live = days.find((d) => d.status === "live");
  const completed = days.filter((d) => d.status === "completed").length;
  let phase = "in_progress";
  let label; let badge;
  if (completed === days.length) { phase = "completed"; label = "All Classes Completed"; badge = "all_completed"; }
  else if (live) { label = `Day ${live.day} — LIVE NOW`; badge = "live_now"; }
  else if (completed === 0) { phase = "upcoming"; label = "Upcoming"; badge = "upcoming"; }
  else { label = `Day ${completed} Completed`; badge = "day_completed"; }
  const upcoming = days.find((d) => d.status === "upcoming");
  const next = live ? { kind: "ends", day: live.day, at: live.end } : upcoming ? { kind: "starts", day: upcoming.day, at: upcoming.start } : null;
  return { phase, label, badge, days, next };
}
