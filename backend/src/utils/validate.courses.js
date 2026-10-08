/**
 * Validators for live sessions, courses, enrollments and payment input.
 * Same convention as validate.js: each returns an array of
 * { message, code } objects (empty = valid).
 */

import { isNonEmptyString, isValidObjectIdString } from "./validate.js";
import { isValidSlugFormat } from "./slug.js";
import { extractYouTubeVideoId } from "./youtube.js";
import { LIVE_STATUSES, COURSE_STATUSES, MEETING_PROVIDERS, CURRENCIES, ENROLLMENT_STATUSES } from "./courseEnums.js";
import { parseCourseInstant } from "./ist.js";

export const MAX_COURSE_SESSIONS = 120;

const err = (message, code = "INVALID_INPUT") => ({ message, code });
const inList = (v, list) => typeof v === "string" && list.includes(v);

export function parseDateInput(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d; // undefined = invalid
}

/** Only https Google Meet links — the only provider supported today. */
export function isValidMeetLink(value) {
  if (typeof value !== "string" || value.length > 300) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && u.hostname === "meet.google.com";
  } catch {
    return false;
  }
}

export function validateLiveSessionInput(data, { partial = false } = {}) {
  const errors = [];
  if (!data || typeof data !== "object") return [err("Request body must be a JSON object.")];

  if (!partial || data.youtubeUrl !== undefined || data.youtubeVideoId !== undefined) {
    const source = data.youtubeVideoId ?? data.youtubeUrl;
    if (!extractYouTubeVideoId(source)) errors.push(err("A valid YouTube video URL or 11-character video id is required."));
  }
  if (data.title !== undefined && data.title !== "" && !isNonEmptyString(data.title, 200)) errors.push(err("title must be 1–200 characters."));
  if (data.description !== undefined && data.description !== null && (typeof data.description !== "string" || data.description.length > 5000)) {
    errors.push(err("description must be a string up to 5000 characters."));
  }
  if (data.status !== undefined && !inList(data.status, LIVE_STATUSES)) errors.push(err(`status must be one of: ${LIVE_STATUSES.join(", ")}.`, "INVALID_STATUS"));
  for (const key of ["scheduledStartTime", "actualStartTime", "actualEndTime"]) {
    if (data[key] !== undefined && parseDateInput(data[key]) === undefined) errors.push(err(`${key} must be a valid date/time.`));
  }
  if (data.isPublished !== undefined && typeof data.isPublished !== "boolean") errors.push(err("isPublished must be a boolean."));
  if (data.syncEnabled !== undefined && typeof data.syncEnabled !== "boolean") errors.push(err("syncEnabled must be a boolean."));
  if (data.thumbnailUrl !== undefined && data.thumbnailUrl !== null && data.thumbnailUrl !== "") {
    let ok = false;
    try { ok = new URL(data.thumbnailUrl).protocol === "https:" && data.thumbnailUrl.length <= 500; } catch { /* invalid */ }
    if (!ok) errors.push(err("thumbnailUrl must be an https URL."));
  }
  return errors;
}

export function validateCourseInput(data, { partial = false } = {}) {
  const errors = [];
  if (!data || typeof data !== "object") return [err("Request body must be a JSON object.")];

  if (!partial || data.title !== undefined) {
    if (!isNonEmptyString(data.title, 200)) errors.push(err("title is required (max 200 characters)."));
  }
  if (!partial || data.slug !== undefined) {
    if (!isValidSlugFormat(data.slug)) errors.push(err("slug must be lowercase letters, numbers and single dashes."));
  }
  if (data.description !== undefined && data.description !== null && (typeof data.description !== "string" || data.description.length > 10000)) {
    errors.push(err("description must be a string up to 10000 characters."));
  }
  if (data.shortDescription !== undefined && data.shortDescription !== null && (typeof data.shortDescription !== "string" || data.shortDescription.length > 300)) {
    errors.push(err("shortDescription must be a string up to 300 characters."));
  }
  if (data.teacher !== undefined && data.teacher !== null && (typeof data.teacher !== "string" || data.teacher.length > 150)) {
    errors.push(err("teacher must be a string up to 150 characters."));
  }
  if (data.thumbnailKey !== undefined && data.thumbnailKey !== null && data.thumbnailKey !== "" && !/^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/.test(data.thumbnailKey)) {
    errors.push(err("thumbnailKey must be a key returned by the media upload endpoint (image)."));
  }
  for (const key of ["startDate", "endDate", "enrollmentClosesAt"]) {
    if (data[key] !== undefined && parseCourseInstant(data[key]) === undefined) errors.push(err(`${key} must be a valid date/time (IST, e.g. 2026-10-10T19:30).`));
  }
  if (data.retentionDays !== undefined && (!Number.isInteger(data.retentionDays) || data.retentionDays < 0 || data.retentionDays > 365)) {
    errors.push(err("retentionDays must be a whole number between 0 and 365."));
  }
  if (data.sessions !== undefined) errors.push(...validateSessions(data.sessions));
  if (!partial || data.price !== undefined) {
    if (typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 0 || data.price > 1_000_000) {
      errors.push(err("price must be a number between 0 and 1,000,000."));
    } else if (Math.round(data.price * 100) !== data.price * 100 && Math.abs(Math.round(data.price * 100) - data.price * 100) > 1e-6) {
      errors.push(err("price can have at most 2 decimal places."));
    }
  }
  if (data.currency !== undefined && !inList(data.currency, CURRENCIES)) errors.push(err(`currency must be one of: ${CURRENCIES.join(", ")}.`));
  if (data.status !== undefined && !inList(data.status, COURSE_STATUSES)) errors.push(err(`status must be one of: ${COURSE_STATUSES.join(", ")}.`, "INVALID_STATUS"));
  if (data.meetingProvider !== undefined && !inList(data.meetingProvider, MEETING_PROVIDERS)) errors.push(err(`meetingProvider must be one of: ${MEETING_PROVIDERS.join(", ")}.`));
  if (data.meetingLink !== undefined && data.meetingLink !== null && data.meetingLink !== "" && !isValidMeetLink(data.meetingLink)) {
    errors.push(err("meetingLink must be an https://meet.google.com/... link."));
  }
  if (data.maxStudents !== undefined && data.maxStudents !== null && (!Number.isInteger(data.maxStudents) || data.maxStudents < 1 || data.maxStudents > 100000)) {
    errors.push(err("maxStudents must be a whole number ≥ 1."));
  }
  if (data.sortOrder !== undefined && (!Number.isInteger(data.sortOrder) || data.sortOrder < -100000 || data.sortOrder > 100000)) {
    errors.push(err("sortOrder must be a whole number."));
  }
  if (data.isPublished !== undefined && typeof data.isPublished !== "boolean") errors.push(err("isPublished must be a boolean."));

  const start = parseCourseInstant(data.startDate);
  const end = parseCourseInstant(data.endDate);
  if (start && end && end < start) errors.push(err("endDate cannot be before startDate."));
  return errors;
}

/** Each class day: exact start/end instants (IST input), optional title and private Google Meet link. Days must be in order and must not overlap. */
export function validateSessions(sessions) {
  const errors = [];
  if (!Array.isArray(sessions)) return [err("sessions must be an array.")];
  if (sessions.length > MAX_COURSE_SESSIONS) return [err(`A course can have at most ${MAX_COURSE_SESSIONS} class days.`)];
  let previousEnd = null;
  sessions.forEach((s, i) => {
    const n = i + 1;
    if (!s || typeof s !== "object") { errors.push(err(`Day ${n}: invalid entry.`)); return; }
    const start = parseCourseInstant(s.startsAt);
    const end = parseCourseInstant(s.endsAt);
    if (!start || !end) { errors.push(err(`Day ${n}: a valid start and end date/time is required.`)); return; }
    if (end <= start) errors.push(err(`Day ${n}: the class must end after it starts.`));
    if (previousEnd && start < previousEnd) errors.push(err(`Day ${n}: classes must be in order and cannot overlap the previous day.`));
    previousEnd = end;
    if (s.title !== undefined && s.title !== null && (typeof s.title !== "string" || s.title.length > 150)) errors.push(err(`Day ${n}: title must be up to 150 characters.`));
    if (s.meetingLink !== undefined && s.meetingLink !== null && s.meetingLink !== "" && !isValidMeetLink(s.meetingLink)) errors.push(err(`Day ${n}: meetingLink must be an https://meet.google.com/... link.`));
  });
  return errors;
}

/** Cross-field rule on the MERGED course: enrollment must close no later than the final class ends. */
export function validateSchedule({ sessions, enrollmentClosesAt }) {
  const closes = parseCourseInstant(enrollmentClosesAt);
  if (!closes || !Array.isArray(sessions) || sessions.length === 0) return [];
  const ends = sessions.map((s) => parseCourseInstant(s?.endsAt)).filter(Boolean);
  const lastEnd = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
  return lastEnd && closes > lastEnd ? [err("Enrollment closing time cannot be after the final class ends.")] : [];
}

/** WhatsApp number: optional leading +, 8–15 digits (spaces/dashes/brackets allowed on input). Returns normalized "+<digits>" or null. */
export function normalizeWhatsapp(value) {
  if (typeof value !== "string" || value.length > 30) return null;
  if (!/^\+?[\d\s\-()]+$/.test(value.trim())) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEnrollmentInput(data) {
  const errors = [];
  if (!data || typeof data !== "object") return [err("Request body must be a JSON object.")];
  if (!isNonEmptyString(data.fullName, 100) || data.fullName.trim().length < 2) errors.push(err("Full name is required (2–100 characters)."));
  if (!normalizeWhatsapp(data.whatsapp)) errors.push(err("A valid WhatsApp number with country code is required (8–15 digits)."));
  if (data.email !== undefined && data.email !== null && data.email !== "" && (typeof data.email !== "string" || data.email.length > 254 || !EMAIL_RE.test(data.email.trim()))) {
    errors.push(err("email must be a valid email address."));
  }
  return errors;
}

/** Paid flow: the student's details are collected BEFORE payment, so the email is required here. */
export function validatePaidEnrollmentInput(data) {
  const errors = validateEnrollmentInput(data);
  if (errors.length === 0 && (typeof data.email !== "string" || !data.email.trim())) errors.push(err("Your Gmail / email address is required."));
  return errors;
}

export function validateEnrollmentUpdate(data) {
  const errors = [];
  if (!data || typeof data !== "object") return [err("Request body must be a JSON object.")];
  if (data.status !== undefined && !inList(data.status, ENROLLMENT_STATUSES)) errors.push(err(`status must be one of: ${ENROLLMENT_STATUSES.join(", ")}.`, "INVALID_STATUS"));
  if (data.paymentStatus !== undefined || data.paymentId !== undefined) errors.push(err("Payment fields are controlled by the server and cannot be edited.", "FORBIDDEN_FIELD"));
  if (data.meetLinkSent !== undefined && typeof data.meetLinkSent !== "boolean") errors.push(err("meetLinkSent must be a boolean."));
  if (data.status === undefined && data.meetLinkSent === undefined) errors.push(err("Nothing to update."));
  return errors;
}

export const ORDER_ID_RE = /^order_[A-Za-z0-9]{6,40}$/;
export const PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{6,40}$/;
export const SIGNATURE_RE = /^[a-f0-9]{64}$/;
export const CLAIM_TOKEN_RE = /^[a-f0-9]{64}$/;

export { isValidObjectIdString };
