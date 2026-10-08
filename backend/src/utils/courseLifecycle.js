/**
 * Course lifecycle — a PURE function of (course document, absolute timestamp).
 *
 * Nothing here runs on a timer and nothing is stored as "current state": every request recomputes the state
 * from the authoritative timestamps in MongoDB (sessions[].startsAt / endsAt, enrollmentClosesAt, archiveAt)
 * and the Worker's clock. Refreshing, switching device or IP cannot change the answer.
 *
 * Boundaries are half-open: a session is LIVE for startsAt <= now < endsAt, so at the exact endsAt instant
 * it is already completed. Enrollment is open for now < enrollmentClosesAt, so at the exact closing instant
 * it is already closed.
 */

import { DAY_MS, istNextDayStart } from "./ist.js";

/** Enrolled students can see a class's Meet link from this long before it starts. */
export const ACCESS_LEAD_MS = 30 * 60 * 1000;

const ms = (d) => (d instanceof Date ? d.getTime() : typeof d === "number" ? d : d ? new Date(d).getTime() : NaN);
const iso = (v) => (Number.isFinite(ms(v)) ? new Date(ms(v)).toISOString() : null);

/** Sorted, validated copy of the stored sessions (Dates). Entries without a valid start < end are dropped. */
export function normalizeSessions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      title: typeof s?.title === "string" ? s.title.trim() : "",
      startsAt: new Date(ms(s?.startsAt)),
      endsAt: new Date(ms(s?.endsAt)),
      meetingLink: typeof s?.meetingLink === "string" && s.meetingLink.trim() ? s.meetingLink.trim() : null,
    }))
    .filter((s) => Number.isFinite(s.startsAt.getTime()) && Number.isFinite(s.endsAt.getTime()) && s.startsAt < s.endsAt)
    .sort((a, b) => a.startsAt - b.startsAt);
}

/**
 * When the course leaves the public site: 00:00 IST of the day after the final class ends, plus `retentionDays`.
 * (A class ending exactly at midnight belongs to the previous day, hence `- 1`.)
 */
export function computeArchiveAt(sessions, retentionDays = 0) {
  const list = normalizeSessions(sessions);
  if (list.length === 0) return null;
  const lastEnd = list[list.length - 1].endsAt.getTime();
  const days = Number.isInteger(retentionDays) && retentionDays > 0 ? retentionDays : 0;
  return new Date(istNextDayStart(lastEnd - 1) + days * DAY_MS);
}

export function sessionStatus(session, now) {
  if (now < ms(session.startsAt)) return "upcoming";
  if (now < ms(session.endsAt)) return "live";
  return "completed";
}

/** Is the course allowed on the public site at `now`? (published, not draft/archived, retention not over) */
export function isPubliclyVisible(course, now = Date.now()) {
  if (!course || !course.isPublished) return false;
  if (course.status === "draft" || course.status === "archived") return false;
  const archiveAt = ms(course.archiveAt);
  return !(Number.isFinite(archiveAt) && now >= archiveAt);
}

export function computeLifecycle(course, now = Date.now()) {
  const sessions = normalizeSessions(course.sessions);
  const closesAt = ms(course.enrollmentClosesAt);
  const hasClose = Number.isFinite(closesAt);
  const archiveAtMs = ms(course.archiveAt);
  const hasArchive = Number.isFinite(archiveAtMs);

  const days = sessions.map((s, i) => ({ day: i + 1, title: s.title, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), status: sessionStatus(s, now) }));
  const completedDays = days.filter((d) => d.status === "completed").length;
  const live = days.find((d) => d.status === "live") || null;

  let phase;
  if (course.status === "archived" || (hasArchive && now >= archiveAtMs)) phase = "archived";
  else if (sessions.length === 0) phase = "unscheduled";
  else if (now < sessions[0].startsAt.getTime()) phase = "upcoming";
  else if (now >= sessions[sessions.length - 1].endsAt.getTime()) phase = "completed";
  else phase = "in_progress";

  let label = null;
  let badge = null;
  if (phase === "completed") { label = "All Classes Completed"; badge = "all_completed"; }
  else if (phase === "in_progress") {
    if (live) { label = `Day ${live.day} — LIVE NOW`; badge = "live_now"; }
    else { label = `Day ${completedDays} Completed`; badge = "day_completed"; }
  } else if (phase === "upcoming") { label = "Upcoming"; badge = "upcoming"; }
  else if (phase === "archived") { label = "Archived"; badge = "archived"; }

  // Enrollment gate. Draft / archived / finished courses can never be enrolled in, whatever the admin status says.
  let enrollment;
  if (phase === "archived" || course.status === "draft") enrollment = "unavailable";
  else if (phase === "completed" || course.status === "completed" || course.status === "enrollment_closed") enrollment = "closed";
  else if (course.status === "coming_soon") enrollment = "not_open";
  else if (course.status === "enrollment_open") enrollment = hasClose && now >= closesAt ? "closed" : "open";
  else enrollment = "closed";

  let effectiveStatus = course.status;
  if (phase === "archived") effectiveStatus = "archived";
  else if (phase === "completed") effectiveStatus = "completed";
  else if (course.status === "enrollment_open" && enrollment === "closed") effectiveStatus = "enrollment_closed";

  // Next instant at which anything above can change — lets clients re-sync exactly then instead of guessing.
  const candidates = [];
  for (const s of sessions) { candidates.push(s.startsAt.getTime(), s.endsAt.getTime()); }
  if (hasClose && course.status === "enrollment_open") candidates.push(closesAt);
  if (hasArchive) candidates.push(archiveAtMs);
  const next = candidates.filter((t) => t > now).sort((a, b) => a - b)[0];

  return {
    phase,
    label,
    badge,
    totalDays: sessions.length,
    completedDays,
    currentDay: live ? live.day : null,
    sessions: days,
    enrollment: { state: enrollment, closesAt: hasClose ? new Date(closesAt).toISOString() : null },
    effectiveStatus,
    archiveAt: hasArchive ? new Date(archiveAtMs).toISOString() : null,
    nextTransitionAt: next === undefined ? null : new Date(next).toISOString(),
  };
}

/** Why a (public) enrollment / payment attempt is refused — or null when the gate is open. */
export function enrollmentGate(course, now = Date.now()) {
  if (!isPubliclyVisible(course, now)) return { status: 404, code: "NOT_FOUND", message: "Course not found." };
  const { enrollment } = computeLifecycle(course, now);
  if (enrollment.state === "open") return null;
  if (enrollment.state === "not_open") return { status: 409, code: "ENROLLMENT_CLOSED", message: "Enrollment has not opened for this course yet." };
  return { status: 409, code: "ENROLLMENT_CLOSED", message: "Enrollment for this course is closed." };
}

/** The Meet link an admin should send now: the live class, else the next upcoming one, else the course-level fallback. */
export function pickMeetingLink(course, now = Date.now()) {
  const sessions = normalizeSessions(course.sessions);
  const current = sessions.find((s) => now >= s.startsAt.getTime() && now < s.endsAt.getTime()) || sessions.find((s) => s.startsAt.getTime() > now);
  return current?.meetingLink || course.meetingLink || null;
}

/**
 * What an ENROLLED student may see: every day's schedule, but a Meet link only for a class that is live or
 * starts within ACCESS_LEAD_MS. Completed classes never expose a link again.
 */
export function studentSessions(course, now = Date.now()) {
  const sessions = normalizeSessions(course.sessions);
  return sessions.map((s, i) => {
    const status = sessionStatus(s, now);
    const linkVisible = status !== "completed" && now >= s.startsAt.getTime() - ACCESS_LEAD_MS;
    return { day: i + 1, title: s.title, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), status, meetingLink: linkVisible ? s.meetingLink : null };
  });
}

/** Earliest instant at which the student's view can change (a class starting, a link window opening, a class ending). */
export function studentNextChangeAt(course, now = Date.now()) {
  const times = [];
  for (const s of normalizeSessions(course.sessions)) times.push(s.startsAt.getTime() - ACCESS_LEAD_MS, s.startsAt.getTime(), s.endsAt.getTime());
  const next = times.filter((t) => t > now).sort((a, b) => a - b)[0];
  return next === undefined ? null : iso(next);
}
