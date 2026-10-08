import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { normalizeWhatsapp } from "../../utils/validate.courses.js";
import { ENROLLMENT_PAYMENT_STATUSES, ENROLLMENT_TRANSITIONS, LEGACY_ENROLLMENT_STATUS } from "../../utils/courseEnums.js";

/**
 * Data access for the `enrollments` collection (one collection for both entry points).
 *
 * Document shape:
 *   { _id, courseId, fullName, whatsapp, email,
 *     status,         // pending | approved | rejected | cancelled   (admin-controlled; legacy "confirmed" = approved)
 *     paymentStatus,  // unpaid | paid | failed | refunded           (server-controlled ONLY)
 *     paymentId,      // payments._id - only present once a verified payment is attached
 *     source,         // "request" (enrollment request form) | "payment" (paid via Razorpay flow)
 *     activeKey,      // "<courseId>:<whatsapp>" while status is pending/approved - drives the duplicate guard
 *     meetLinkSentAt, createdAt, updatedAt }
 *
 * Future Razorpay hook: once a payment is verified server-side, call setEnrollmentPaymentStatus()
 * (never from a public route). Whether "paid" also approves the enrollment is a business rule for that phase.
 *
 * Contains private student data (WhatsApp, email) — only admin endpoints ever return these documents.
 */

const COLLECTION = "enrollments";
const ACTIVE_STATUSES = ["pending", "approved", "confirmed"]; // "confirmed" = legacy approved

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function getCollection(config) {
  const db = await getDb(config);
  return db.collection(COLLECTION);
}

/** Run via `npm run bootstrap:indexes` — see the migration notes: this must run before request enrollments go live. */
export async function ensureEnrollmentIndexes(config) {
  const c = await getCollection(config);

  // v1 created a plain unique index on paymentId. Request enrollments have no payment yet, so it must be
  // partial (unique only where paymentId is set). Same name -> drop the old definition first.
  const existing = await c.indexes().catch(() => []);
  const old = existing.find((i) => i.name === "paymentId_1" && !i.partialFilterExpression);
  if (old) await c.dropIndex("paymentId_1");
  await c.createIndex({ paymentId: 1 }, { name: "paymentId_1", unique: true, partialFilterExpression: { paymentId: { $type: "objectId" } } });

  // Race-proof duplicate guard: one active (pending/approved) request per course + WhatsApp number.
  await c.createIndex({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $type: "string" } } });

  await c.createIndex({ courseId: 1, createdAt: -1 });
  await c.createIndex({ status: 1 });
  await c.createIndex({ paymentStatus: 1 });
  await c.createIndex({ whatsapp: 1 });
  await c.createIndex({ email: 1 });

  // Idempotent backfill: v1 enrollments only ever existed after a verified payment.
  await c.updateMany({ paymentStatus: { $exists: false }, paymentId: { $exists: true } }, { $set: { paymentStatus: "paid", source: "payment" } });
}

const activeKeyFor = (courseId, whatsapp) => `${String(courseId)}:${whatsapp}`;
const normalizeStatus = (s) => LEGACY_ENROLLMENT_STATUS[s] || s;

/** Enrollment request from the public form. Never paid, never approved — those are server/admin decisions. */
export async function createEnrollmentRequest(config, { courseId, fullName, whatsapp, email }) {
  const normalizedWhatsapp = normalizeWhatsapp(whatsapp);
  const courseObjectId = new ObjectId(courseId);
  const c = await getCollection(config);

  // Friendly application-level check (also covers older payment-flow enrollments, which have no activeKey)…
  const dup = await c.findOne({ courseId: courseObjectId, whatsapp: normalizedWhatsapp, status: { $in: ACTIVE_STATUSES } }, { projection: { _id: 1 } });
  if (dup) throw fail("You have already requested enrollment in this course. We will contact you on WhatsApp.", 409, "ALREADY_ENROLLED");

  const now = new Date();
  const doc = {
    courseId: courseObjectId,
    fullName: fullName.trim(),
    whatsapp: normalizedWhatsapp,
    email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null,
    status: "pending",
    paymentStatus: "unpaid",
    source: "request",
    activeKey: activeKeyFor(courseId, normalizedWhatsapp),
    meetLinkSentAt: null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const result = await c.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  } catch (e) {
    // …and the unique index closes the race between two simultaneous submits.
    if (e.code === 11000 && e.keyPattern?.activeKey) throw fail("You have already requested enrollment in this course. We will contact you on WhatsApp.", 409, "ALREADY_ENROLLED");
    throw e;
  }
}

/** Enrollment created by the existing payment flow (payment already verified server-side). */
export async function createEnrollment(config, { courseId, paymentId, fullName, whatsapp, email }) {
  const now = new Date();
  const doc = {
    courseId: new ObjectId(courseId),
    paymentId: new ObjectId(paymentId),
    fullName: fullName.trim(),
    whatsapp: normalizeWhatsapp(whatsapp),
    email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null,
    status: "pending",
    paymentStatus: "paid",
    source: "payment",
    meetLinkSentAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const c = await getCollection(config);
  try {
    const result = await c.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  } catch (e) {
    if (e.code === 11000) throw fail("An enrollment has already been submitted for this payment.", 409, "ALREADY_ENROLLED");
    throw e;
  }
}

/**
 * SERVER-ONLY hook for the future verified-payment flow (no route calls it).
 * Attaches a verified payment and sets paymentStatus; it deliberately does NOT change `status`.
 */
export async function setEnrollmentPaymentStatus(config, id, { paymentStatus, paymentId }) {
  if (!ENROLLMENT_PAYMENT_STATUSES.includes(paymentStatus)) throw fail("Invalid payment status.", 400, "INVALID_INPUT");
  const existing = await findEnrollmentById(config, id);
  if (!existing) throw fail("Enrollment not found.", 404, "NOT_FOUND");
  const $set = { paymentStatus, updatedAt: new Date() };
  if (paymentId) $set.paymentId = new ObjectId(paymentId);
  const c = await getCollection(config);
  await c.updateOne({ _id: new ObjectId(id) }, { $set });
  return findEnrollmentById(config, id);
}

export async function findEnrollmentByPaymentId(config, paymentId) {
  const c = await getCollection(config);
  return c.findOne({ paymentId: new ObjectId(paymentId) });
}

export async function findEnrollmentById(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const c = await getCollection(config);
  return c.findOne({ _id: new ObjectId(id) });
}

/** Seats taken = approved (incl. legacy "confirmed") enrollments. */
export async function countApprovedForCourse(config, courseId) {
  const c = await getCollection(config);
  return c.countDocuments({ courseId: new ObjectId(courseId), status: { $in: ["approved", "confirmed"] } });
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listEnrollments(config, { courseId, status, paymentStatus, q, limit = 100, skip = 0 } = {}) {
  const c = await getCollection(config);
  const query = {};
  if (courseId && ObjectId.isValid(courseId)) query.courseId = new ObjectId(courseId);
  if (status) query.status = status === "approved" ? { $in: ["approved", "confirmed"] } : status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (typeof q === "string" && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim().slice(0, 100)), "i");
    const digits = q.replace(/\D/g, "");
    query.$or = [{ fullName: rx }, { email: rx }, ...(digits.length >= 3 ? [{ whatsapp: new RegExp(escapeRegex(digits)) }] : [])];
  }
  return c.find(query).sort({ createdAt: -1 }).skip(Math.max(skip, 0)).limit(Math.min(Math.max(limit, 1), 200)).toArray();
}

/**
 * Admin update. Status changes must follow ENROLLMENT_TRANSITIONS; paymentStatus / paymentId are never accepted here.
 * The activeKey is kept in step with the status so the duplicate guard stays correct.
 */
export async function updateEnrollment(config, id, { status, meetLinkSent }) {
  const existing = await findEnrollmentById(config, id);
  if (!existing) throw fail("Enrollment not found.", 404, "NOT_FOUND");

  const $set = { updatedAt: new Date() };
  const $unset = {};
  if (status !== undefined) {
    const current = normalizeStatus(existing.status);
    if (status !== current) {
      if (!(ENROLLMENT_TRANSITIONS[current] || []).includes(status)) {
        throw fail(`An enrollment that is ${current} cannot be changed to ${status}.`, 409, "INVALID_TRANSITION");
      }
      $set.status = status;
      if (status === "pending" || status === "approved") $set.activeKey = activeKeyFor(existing.courseId, existing.whatsapp);
      else $unset.activeKey = "";
    }
  }
  if (meetLinkSent !== undefined) $set.meetLinkSentAt = meetLinkSent ? new Date() : null;

  const update = { $set };
  if (Object.keys($unset).length) update.$unset = $unset;
  const c = await getCollection(config);
  try {
    await c.updateOne({ _id: new ObjectId(id) }, update);
  } catch (e) {
    if (e.code === 11000) throw fail("This student already has an active enrollment in this course.", 409, "ALREADY_ENROLLED");
    throw e;
  }
  return findEnrollmentById(config, id);
}

/** Admin-only projection; course / payment summaries are attached by the controller. */
export function toSafeEnrollment(e, { course, payment } = {}) {
  if (!e) return null;
  // Stored value wins, except a refunded linked payment; very old documents fall back to the payment (or unpaid).
  const paymentStatus = payment?.status === "refunded" ? "refunded" : e.paymentStatus || (e.paymentId ? (payment?.status === "paid" ? "paid" : "unpaid") : "unpaid");
  return {
    id: String(e._id),
    courseId: String(e.courseId),
    paymentId: e.paymentId ? String(e.paymentId) : null,
    fullName: e.fullName,
    whatsapp: e.whatsapp,
    email: e.email || null,
    status: normalizeStatus(e.status),
    paymentStatus,
    source: e.source || (e.paymentId ? "payment" : "request"),
    meetLinkSentAt: e.meetLinkSentAt || null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    course: course ? { id: String(course._id), title: course.title, slug: course.slug, price: course.price, currency: course.currency || "INR", meetingLink: course.meetingLink || null } : null,
    payment: payment ? { status: payment.status, amount: payment.amount, currency: payment.currency, orderId: payment.orderId, gatewayPaymentId: payment.paymentId || null } : null,
  };
}
