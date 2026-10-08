/**
 * Single timezone for the whole course system: Asia/Kolkata (IST, fixed UTC+05:30 — India has no DST,
 * so plain integer arithmetic on the offset is exact).
 *
 * Every instant is stored in MongoDB as a BSON Date (an absolute UTC instant). Admin input that carries no
 * explicit offset ("2026-10-10T19:30" / "2026-10-10") is ALWAYS read as IST, never as the server's or the
 * browser's local time.
 */

export const IST_TIME_ZONE = "Asia/Kolkata";
export const IST_OFFSET_MS = 330 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Parses a course date/time input into a Date.
 *   null | undefined | ""  -> null        (field cleared)
 *   invalid                -> undefined   (callers treat as a validation error)
 * Accepts: "YYYY-MM-DD" (IST midnight), "YYYY-MM-DDTHH:mm[:ss]" (IST), ISO strings with Z / ±hh:mm, epoch ms numbers.
 */
export function parseCourseInstant(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isFinite(value) && !Number.isNaN(d.getTime()) ? d : undefined;
  }
  if (typeof value !== "string") return undefined;
  const s = value.trim();

  const m = LOCAL_RE.exec(s);
  if (m) {
    const [y, mo, d, h = 0, mi = 0, sec = 0] = m.slice(1).map((x) => (x === undefined ? 0 : Number(x)));
    const utc = new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
    // Round-trip check rejects impossible values such as 2026-02-31 or 25:00 instead of silently rolling over.
    if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d || utc.getUTCHours() !== h || utc.getUTCMinutes() !== mi || utc.getUTCSeconds() !== sec) return undefined;
    return new Date(utc.getTime() - IST_OFFSET_MS);
  }
  if (OFFSET_RE.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/** Start (00:00 IST) of the IST calendar day containing `ms`. */
export function istDayStart(ms) {
  return Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

/** 00:00 IST of the day AFTER the IST day containing `ms`. */
export function istNextDayStart(ms) {
  return istDayStart(ms) + DAY_MS;
}
