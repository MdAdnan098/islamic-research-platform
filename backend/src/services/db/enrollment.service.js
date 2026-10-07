import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { normalizeWhatsapp } from "../../utils/validate.courses.js";

/**
 * Data access for the `enrollments` collection.
 *
 * Document shape:
 *   { _id, courseId, paymentId, fullName, whatsapp, email, status,
 *     meetLinkSentAt, createdAt, updatedAt }
 *
 * `paymentId` references payments._id (not the gateway id). A unique
 * index on it guarantees one enrollment per verified payment, even if
 * the form is submitted twice or two requests race.
 *
 * Contains private student data (WhatsApp, email) — only the admin
 * endpoints ever return these documents.
 */

const COLLECTION = "enrollments";

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

export async function ensureEnrollmentIndexes(config) {
  const c = await getCollection(config);
  await c.createIndex({ paymentId: 1 }, { unique: true });
  await c.createIndex({ courseId: 1, createdAt: -1 });
  await c.createIndex({ status: 1 });
}

export async function createEnrollment(config, { courseId, paymentId, fullName, whatsapp, email }) {
  const now = new Date();
  const doc = {
    courseId: new ObjectId(courseId),
    paymentId: new ObjectId(paymentId),
    fullName: fullName.trim(),
    whatsapp: normalizeWhatsapp(whatsapp),
    email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null,
    status: "pending",
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

export async function findEnrollmentByPaymentId(config, paymentId) {
  const c = await getCollection(config);
  return c.findOne({ paymentId: new ObjectId(paymentId) });
}

export async function findEnrollmentById(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const c = await getCollection(config);
  return c.findOne({ _id: new ObjectId(id) });
}

export async function listEnrollments(config, { courseId, status, limit = 100, skip = 0 } = {}) {
  const c = await getCollection(config);
  const query = {};
  if (courseId && ObjectId.isValid(courseId)) query.courseId = new ObjectId(courseId);
  if (status) query.status = status;
  return c.find(query).sort({ createdAt: -1 }).skip(Math.max(skip, 0)).limit(Math.min(Math.max(limit, 1), 200)).toArray();
}

export async function updateEnrollment(config, id, { status, meetLinkSent }) {
  const existing = await findEnrollmentById(config, id);
  if (!existing) throw fail("Enrollment not found.", 404, "NOT_FOUND");
  const $set = { updatedAt: new Date() };
  if (status !== undefined) $set.status = status;
  if (meetLinkSent !== undefined) $set.meetLinkSentAt = meetLinkSent ? new Date() : null;
  const c = await getCollection(config);
  await c.updateOne({ _id: new ObjectId(id) }, { $set });
  return findEnrollmentById(config, id);
}

/** Admin-only projection; course / payment summaries are attached by the controller. */
export function toSafeEnrollment(e, { course, payment } = {}) {
  if (!e) return null;
  return {
    id: String(e._id),
    courseId: String(e.courseId),
    paymentId: String(e.paymentId),
    fullName: e.fullName,
    whatsapp: e.whatsapp,
    email: e.email || null,
    status: e.status,
    meetLinkSentAt: e.meetLinkSentAt || null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    course: course ? { id: String(course._id), title: course.title, slug: course.slug, meetingLink: course.meetingLink || null } : null,
    payment: payment ? { status: payment.status, amount: payment.amount, currency: payment.currency, orderId: payment.orderId, gatewayPaymentId: payment.paymentId || null } : null,
  };
}
