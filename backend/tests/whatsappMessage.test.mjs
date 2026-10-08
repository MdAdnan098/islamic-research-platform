// Run: cd backend && node --test tests/
// Pure-function tests for the admin WhatsApp click-to-chat helper (no database, no network).
import test from "node:test";
import assert from "node:assert/strict";
import { parseCourseInstant } from "../src/utils/ist.js";
import { toSafeEnrollment } from "../src/services/db/enrollment.service.js";
import { waDigits, waLink, enrollmentMessage, istDateText, istTimeText, firstUpcomingSession } from "../../frontend/src/lib/whatsapp.js";

const at = (s) => parseCourseInstant(s).toISOString();
const NOW = parseCourseInstant("2026-10-08T12:00").getTime();
const enrollment = (over = {}) => ({
  fullName: "Mohammad Adnan",
  whatsapp: "+919876543210",
  paymentStatus: "paid",
  course: { title: "Usool-e-Hadees Basic Course", sessions: [{ startsAt: at("2026-10-10T20:00"), endsAt: at("2026-10-10T21:30") }, { startsAt: at("2026-10-11T20:00"), endsAt: at("2026-10-11T21:30") }] },
  ...over,
});

test("number normalisation: India and others", () => {
  assert.equal(waDigits("+919876543210"), "919876543210");
  assert.equal(waDigits("+9876543210"), "919876543210"); // stored without country code -> India
  assert.equal(waDigits("09876543210"), "919876543210");
  assert.equal(waDigits("98765 43210"), "919876543210");
  assert.equal(waDigits("+971501234567"), "971501234567"); // other country kept as stored
  assert.equal(waDigits("0091 98765 43210"), "919876543210");
});

test("number normalisation: invalid numbers return null", () => {
  for (const bad of [null, undefined, "", "   ", "abc", "12345", "+1234567890123456", "+915876543210", "1234567890", "+91 98765", "98765432101234567890123456789012"]) assert.equal(waDigits(bad), null, String(bad));
  assert.equal(waLink("abc", "hi"), null);
});

test("IST date and time text, independent of device timezone", () => {
  assert.equal(istDateText(at("2026-10-10T20:00")), "10 October 2026");
  assert.equal(istDateText(at("2026-10-10T00:30")), "10 October 2026"); // 19:00 UTC on the 9th is still the 10th in IST
  assert.equal(istTimeText(at("2026-10-10T20:00")), "raat 8:00 baje");
  assert.equal(istTimeText(at("2026-10-10T19:30")), "shaam 7:30 baje");
  assert.equal(istTimeText(at("2026-10-10T07:00")), "subah 7:00 baje");
  assert.equal(istTimeText(at("2026-10-10T12:00")), "dopahar 12:00 baje");
  assert.equal(istTimeText(at("2026-10-10T00:15")), "raat 12:15 baje");
  assert.equal(istDateText("junk"), "");
});

test("message matches the required format exactly", () => {
  const msg = enrollmentMessage(enrollment(), NOW);
  assert.equal(
    msg,
    "Assalamu Alaikum, Mohammad Adnan\n\nAapka enrollment Usool-e-Hadees Basic Course ke liye successfully confirm ho gaya hai.\n\nAapki online class Google Meet par 10 October 2026 ko raat 8:00 baje se shuru hogi.\n\nClass shuru hone se pehle Google Meet ki link aapko aapke WhatsApp number par bhej di jayegi.\n\nJazakallahu Khairan."
  );
});

test("uses the first UPCOMING session; never invents a date", () => {
  const e = enrollment();
  assert.match(enrollmentMessage(e, parseCourseInstant("2026-10-10T21:00").getTime()), /11 October 2026 ko raat 8:00 baje/);
  assert.equal(firstUpcomingSession(e.course.sessions, parseCourseInstant("2026-10-12T00:00").getTime()), null);
  assert.equal(enrollmentMessage(e, parseCourseInstant("2026-10-12T00:00").getTime()), null); // all classes over
  assert.equal(enrollmentMessage(enrollment({ course: { title: "X", sessions: [] } }), NOW), null);
  assert.equal(enrollmentMessage(enrollment({ course: null }), NOW), null);
  assert.equal(enrollmentMessage(enrollment({ fullName: "  " }), NOW), null);
});

test("wa.me link: right number, encoded text, nothing else", () => {
  const url = waLink("+9876543210", enrollmentMessage(enrollment(), NOW));
  assert.ok(url.startsWith("https://wa.me/919876543210?text="));
  const text = new URL(url).searchParams.get("text");
  assert.equal(text, enrollmentMessage(enrollment(), NOW));
  assert.ok(!url.includes(" ") && !url.includes("\n"));
  assert.equal(waLink("+919876543210"), "https://wa.me/919876543210");
});

test("student name with special characters is encoded safely", () => {
  const msg = enrollmentMessage(enrollment({ fullName: "Abdul & Co? #1 मोहम्मद" }), NOW);
  assert.equal(new URL(waLink("+919876543210", msg)).searchParams.get("text"), msg);
});

test("admin enrollment payload carries session times only (no meeting links per session)", () => {
  const course = { _id: "c1", title: "T", slug: "t", price: 100, sessions: [{ startsAt: new Date(at("2026-10-10T20:00")), endsAt: new Date(at("2026-10-10T21:30")), meetingLink: "https://meet.google.com/aaa-bbbb-ccc" }] };
  const safe = toSafeEnrollment({ _id: "e1", courseId: "c1", fullName: "A", whatsapp: "+919876543210", status: "approved", paymentStatus: "paid" }, { course });
  assert.deepEqual(safe.course.sessions, [{ startsAt: at("2026-10-10T20:00"), endsAt: at("2026-10-10T21:30") }]);
});
