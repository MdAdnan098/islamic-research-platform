// Run: cd backend && node --test tests/
// Pure-function tests for the IST helpers and the course lifecycle (no database, no network, no dependencies).
import test from "node:test";
import assert from "node:assert/strict";
import { parseCourseInstant, istNextDayStart, DAY_MS } from "../src/utils/ist.js";
import { computeLifecycle, computeArchiveAt, enrollmentGate, isPubliclyVisible, studentSessions, ACCESS_LEAD_MS } from "../src/utils/courseLifecycle.js";
import { validateSessions, validateSchedule } from "../src/utils/validate.courses.js";
import { formatIstFull } from "../../frontend/src/lib/ist.js";

const ist = (s) => parseCourseInstant(s).getTime(); // IST wall-clock string -> UTC ms

// 3-day course: 10, 11, 12 Oct 2026, 19:30–21:00 IST. Enrollment closes 09 Oct 18:00 IST.
const course = (over = {}) => ({
  status: "enrollment_open",
  isPublished: true,
  enrollmentClosesAt: parseCourseInstant("2026-10-09T18:00"),
  retentionDays: 0,
  sessions: ["2026-10-10", "2026-10-11", "2026-10-12"].map((d) => ({ title: "", startsAt: parseCourseInstant(`${d}T19:30`), endsAt: parseCourseInstant(`${d}T21:00`), meetingLink: `https://meet.google.com/${d}` })),
  archiveAt: computeArchiveAt([{ startsAt: parseCourseInstant("2026-10-12T19:30"), endsAt: parseCourseInstant("2026-10-12T21:00") }], 0),
  ...over,
});

test("IST parsing: wall-clock input is IST regardless of server timezone", () => {
  assert.equal(parseCourseInstant("2026-10-10T19:30").toISOString(), "2026-10-10T14:00:00.000Z");
  assert.equal(parseCourseInstant("2026-10-10").toISOString(), "2026-10-09T18:30:00.000Z");
  assert.equal(parseCourseInstant("2026-10-10T19:30:00Z").toISOString(), "2026-10-10T19:30:00.000Z");
  assert.equal(parseCourseInstant("2026-10-10T19:30:00+05:30").toISOString(), "2026-10-10T14:00:00.000Z");
});

test("IST parsing: rejects impossible dates and junk", () => {
  for (const bad of ["2026-02-31", "2026-13-01", "2026-10-10T25:00", "tomorrow", "10/10/2026", {}]) assert.equal(parseCourseInstant(bad), undefined, String(bad));
  assert.equal(parseCourseInstant(""), null);
  assert.equal(parseCourseInstant(null), null);
});

test("enrollment: open strictly before the closing instant, closed AT it", () => {
  const c = course();
  const closes = ist("2026-10-09T18:00");
  assert.equal(computeLifecycle(c, closes - 1).enrollment.state, "open");
  assert.equal(computeLifecycle(c, closes - 1).effectiveStatus, "enrollment_open");
  assert.equal(computeLifecycle(c, closes).enrollment.state, "closed");
  assert.equal(computeLifecycle(c, closes).effectiveStatus, "enrollment_closed");
  assert.equal(enrollmentGate(c, closes - 1), null);
  assert.equal(enrollmentGate(c, closes).code, "ENROLLMENT_CLOSED");
});

test("enrollment: coming_soon / draft / archived never open", () => {
  const t = ist("2026-10-01T10:00");
  assert.equal(enrollmentGate(course({ status: "coming_soon" }), t).code, "ENROLLMENT_CLOSED");
  assert.equal(enrollmentGate(course({ status: "draft" }), t).code, "NOT_FOUND");
  assert.equal(enrollmentGate(course({ status: "archived" }), t).code, "NOT_FOUND");
  assert.equal(enrollmentGate(course({ isPublished: false }), t).code, "NOT_FOUND");
});

test("class lifecycle: upcoming -> Day 1 live -> Day 1 completed -> ... -> All Classes Completed", () => {
  const c = course();
  const at = (s) => computeLifecycle(c, ist(s));
  assert.equal(at("2026-10-10T19:29:59").label, "Upcoming");
  assert.equal(at("2026-10-10T19:30:00").label, "Day 1 — LIVE NOW");
  assert.equal(at("2026-10-10T20:59:59").label, "Day 1 — LIVE NOW");
  assert.equal(at("2026-10-10T21:00:00").label, "Day 1 Completed");
  assert.equal(at("2026-10-11T10:00:00").label, "Day 1 Completed");
  assert.equal(at("2026-10-11T19:30:00").label, "Day 2 — LIVE NOW");
  assert.equal(at("2026-10-11T21:00:00").label, "Day 2 Completed");
  assert.equal(at("2026-10-12T19:30:00").label, "Day 3 — LIVE NOW");
  assert.equal(at("2026-10-12T20:59:59").phase, "in_progress");
  assert.equal(at("2026-10-12T21:00:00").label, "All Classes Completed");
  assert.equal(at("2026-10-12T21:00:00").phase, "completed");
  assert.equal(at("2026-10-12T21:00:00").effectiveStatus, "completed");
  assert.equal(at("2026-10-12T21:00:00").enrollment.state, "closed");
});

test("per-day statuses are individually correct (days may have different durations)", () => {
  const c = course({ sessions: [
    { startsAt: parseCourseInstant("2026-10-10T19:30"), endsAt: parseCourseInstant("2026-10-10T21:00"), meetingLink: null },
    { startsAt: parseCourseInstant("2026-10-11T06:00"), endsAt: parseCourseInstant("2026-10-11T06:20"), meetingLink: null },
  ] });
  const l = computeLifecycle(c, ist("2026-10-11T06:10"));
  assert.deepEqual(l.sessions.map((s) => s.status), ["completed", "live"]);
});

test("nextTransitionAt is the next exact configured timestamp", () => {
  const c = course();
  const next = (s) => computeLifecycle(c, ist(s)).nextTransitionAt;
  assert.equal(next("2026-10-01T00:00"), parseCourseInstant("2026-10-09T18:00").toISOString()); // enrollment closing
  assert.equal(next("2026-10-09T18:00"), parseCourseInstant("2026-10-10T19:30").toISOString()); // Day 1 start
  assert.equal(next("2026-10-10T19:30"), parseCourseInstant("2026-10-10T21:00").toISOString()); // Day 1 end
  assert.equal(next("2026-10-12T21:00"), c.archiveAt.toISOString());                             // cleanup
  assert.equal(computeLifecycle(c, c.archiveAt.getTime()).nextTransitionAt, null);
});

test("archive: card stays visible after completion and disappears at 00:00 IST the next day (+ retention)", () => {
  const c = course();
  assert.equal(c.archiveAt.toISOString(), parseCourseInstant("2026-10-13T00:00").toISOString());
  assert.equal(isPubliclyVisible(c, ist("2026-10-12T23:59:59")), true);
  assert.equal(isPubliclyVisible(c, ist("2026-10-13T00:00:00")), false);
  assert.equal(computeLifecycle(c, ist("2026-10-13T00:00:00")).phase, "archived");

  const sessions = c.sessions;
  assert.equal(computeArchiveAt(sessions, 3).getTime(), ist("2026-10-13T00:00") + 3 * DAY_MS);
  // a class ending exactly at midnight belongs to the previous day
  assert.equal(computeArchiveAt([{ startsAt: parseCourseInstant("2026-10-12T22:00"), endsAt: parseCourseInstant("2026-10-13T00:00") }]).getTime(), ist("2026-10-13T00:00"));
});

test("IST day maths is exact across UTC midnight", () => {
  // 23:30 IST on 10 Oct is 18:00 UTC on 10 Oct; 00:30 IST on 11 Oct is still 19:00 UTC on 10 Oct.
  assert.equal(istNextDayStart(ist("2026-10-10T23:30")), ist("2026-10-11T00:00"));
  assert.equal(istNextDayStart(ist("2026-10-11T00:30")), ist("2026-10-12T00:00"));
});

test("student access: Meet link only from 30 min before start until the class ends", () => {
  const c = course();
  const link = (s, day) => studentSessions(c, ist(s)).find((x) => x.day === day).meetingLink;
  assert.equal(link("2026-10-10T18:59:59", 1), null);
  assert.equal(link("2026-10-10T19:00:00", 1), "https://meet.google.com/2026-10-10");
  assert.equal(link("2026-10-10T20:59:59", 1), "https://meet.google.com/2026-10-10");
  assert.equal(link("2026-10-10T21:00:00", 1), null);
  assert.equal(link("2026-10-10T19:00:00", 2), null); // tomorrow's link stays hidden
  assert.equal(ACCESS_LEAD_MS, 30 * 60 * 1000);
});

test("public lifecycle output never carries meeting links", async () => {
  const { toPublicCourse } = await import("../src/services/db/course.service.js");
  const pub = toPublicCourse({ ...course(), _id: "abc", title: "T", slug: "t", price: 100, meetingLink: "https://meet.google.com/secret" }, ist("2026-10-10T19:45"));
  assert.ok(!JSON.stringify(pub).includes("meet.google.com"));
  assert.equal(pub.status, "enrollment_closed");
  assert.equal(pub.lifecycle.label, "Day 1 — LIVE NOW");
  assert.ok(!("archiveAt" in pub) && !("archiveAt" in pub.lifecycle));
});

test("validation: sessions ordering, overlap, link and closing-time rules", () => {
  const ok = [{ startsAt: "2026-10-10T19:30", endsAt: "2026-10-10T21:00", meetingLink: "https://meet.google.com/abc-defg-hij" }, { startsAt: "2026-10-11T19:30", endsAt: "2026-10-11T21:00" }];
  assert.equal(validateSessions(ok).length, 0);
  assert.equal(validateSessions([{ startsAt: "2026-10-10T21:00", endsAt: "2026-10-10T19:30" }]).length, 1);
  assert.equal(validateSessions([ok[1], ok[0]]).length, 1); // out of order
  assert.equal(validateSessions([{ ...ok[0], meetingLink: "https://evil.example/x" }]).length, 1);
  assert.equal(validateSessions([{ startsAt: "nonsense", endsAt: "2026-10-10T21:00" }]).length, 1);
  assert.equal(validateSchedule({ sessions: ok, enrollmentClosesAt: "2026-10-09T18:00" }).length, 0);
  assert.equal(validateSchedule({ sessions: ok, enrollmentClosesAt: "2026-10-11T21:00" }).length, 0); // exactly at final end is allowed
  assert.equal(validateSchedule({ sessions: ok, enrollmentClosesAt: "2026-10-11T21:01" }).length, 1);
});

test("Course card date/time: exact IST instant from the backend timestamp, whatever the device timezone is", () => {
  // Same instants the backend stores (parseCourseInstant) -> same wall-clock text in IST.
  assert.equal(formatIstFull(parseCourseInstant("2026-10-10T10:00")), "10 October 2026, 10:00 AM IST");
  assert.equal(formatIstFull(parseCourseInstant("2026-10-10T13:00")), "10 October 2026, 1:00 PM IST");
  assert.equal(formatIstFull(parseCourseInstant("2026-10-12T21:00").toISOString()), "12 October 2026, 9:00 PM IST");
  assert.equal(formatIstFull(parseCourseInstant("2026-10-10T00:00")), "10 October 2026, 12:00 AM IST");
  assert.equal(formatIstFull(null), "");
  assert.equal(formatIstFull("not a date"), "");
});
