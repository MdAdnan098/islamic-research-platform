/**
 * Admin → Enrollments: free wa.me click-to-chat helpers (no WhatsApp API, no paid service).
 * Everything here is pure and display-only: the stored WhatsApp number is never changed, and nothing is sent
 * automatically — the admin's WhatsApp opens with the text typed in, and the admin presses Send.
 */

const IST_OFFSET_MS = 330 * 60 * 1000; // India has no DST: always +05:30
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Stored number -> digits for wa.me (country code included, no "+"), or null when it cannot be trusted.
 * India: 10-digit mobile (6–9…) -> 91…, 0 + 10-digit mobile -> 91…, 91 + 10-digit mobile stays as is.
 * Any other number must already carry its country code (8–15 digits).
 */
export function waDigits(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw || raw.length > 30 || !/^\+?[\d\s\-()]+$/.test(raw)) return null;
  let d = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) d = d.slice(2); // 00-prefixed international format
  if (/^[6-9]\d{9}$/.test(d)) return `91${d}`;
  if (/^0[6-9]\d{9}$/.test(d)) return `91${d.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(d)) return d;
  if (d.length === 10 || d.startsWith("0") || d.startsWith("91")) return null; // looks Indian but is malformed: never guess
  return d.length >= 8 && d.length <= 15 ? d : null;
}

/** https://wa.me/<digits>[?text=<encoded>] — or null when the number is not valid. */
export function waLink(number, text) {
  const d = waDigits(number);
  if (!d) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** First class that has not started yet (sessions come from the course data as ISO instants). */
export function firstUpcomingSession(sessions, now = Date.now()) {
  if (!Array.isArray(sessions)) return null;
  return (
    sessions
      .map((s) => ({ ...s, start: Date.parse(s?.startsAt) }))
      .filter((s) => Number.isFinite(s.start) && s.start > now)
      .sort((a, b) => a.start - b.start)[0] || null
  );
}

/** "10 October 2026" in IST, whatever the admin's device timezone is. */
export function istDateText(instant) {
  const t = new Date(instant).getTime();
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + IST_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "raat 8:00 baje" in IST (subah 4–11, dopahar 12–3, shaam 4–7, raat 8 pm–3 am). */
export function istTimeText(instant) {
  const t = new Date(instant).getTime();
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + IST_OFFSET_MS);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const period = h >= 20 || h < 4 ? "raat" : h < 12 ? "subah" : h < 16 ? "dopahar" : "shaam";
  return `${period} ${h % 12 || 12}:${m} baje`;
}

/**
 * The pre-filled message for a paid enrollment, from the enrollment and its course's real sessions.
 * Returns null when the student or course name is missing, or when the course has no upcoming class — the
 * date/time is never invented, so the caller falls back to a plain chat with no text.
 */
export function enrollmentMessage(e, now = Date.now()) {
  const name = typeof e?.fullName === "string" ? e.fullName.trim() : "";
  const course = typeof e?.course?.title === "string" ? e.course.title.trim() : "";
  const next = firstUpcomingSession(e?.course?.sessions, now);
  if (!name || !course || !next) return null;
  return [
    `Assalamu Alaikum, ${name}`,
    "",
    `Aapka enrollment ${course} ke liye successfully confirm ho gaya hai.`,
    "",
    `Aapki online class Google Meet par ${istDateText(next.start)} ko ${istTimeText(next.start)} se shuru hogi.`,
    "",
    "Class shuru hone se pehle Google Meet ki link aapko aapke WhatsApp number par bhej di jayegi.",
    "",
    "Jazakallahu Khairan.",
  ].join("\n");
}
