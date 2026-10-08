import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";

/**
 * Data access for the `payments` collection — transaction METADATA only.
 * No card / UPI / bank details are ever received or stored by this app
 * (the customer pays inside Razorpay's own checkout).
 *
 * Document shape:
 *   { _id, courseId, orderId, paymentId, amount, currency, status, gateway,
 *     receipt, claimTokenHash, verifiedAt, verifiedVia, failureCode,
 *     createdAt, updatedAt }
 *
 * `amount` is in the smallest currency unit (paise). It is always taken
 * from the course price on the server when the order is created and is
 * what incoming payments are checked against.
 *
 * Status moves: created/pending/failed -> paid -> refunded. A paid
 * payment is never downgraded by a late "failed" event.
 */

const COLLECTION = "payments";

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

export async function ensurePaymentIndexes(config) {
  const c = await getCollection(config);
  await c.createIndex({ orderId: 1 }, { unique: true });
  await c.createIndex({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: "string" } } });
  await c.createIndex({ courseId: 1, status: 1 });
  await c.createIndex({ createdAt: -1 });
}

export async function createPaymentRecord(config, { courseId, orderId, amount, currency, receipt, claimTokenHash, student = null }) {
  const now = new Date();
  const doc = {
    courseId: new ObjectId(courseId),
    orderId,
    paymentId: null,
    amount,
    currency,
    status: "created",
    gateway: "razorpay",
    receipt,
    claimTokenHash,
    student,
    verifiedAt: null,
    verifiedVia: null,
    failureCode: null,
    createdAt: now,
    updatedAt: now,
  };
  const c = await getCollection(config);
  const result = await c.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function findPaymentByOrderId(config, orderId) {
  const c = await getCollection(config);
  return c.findOne({ orderId });
}

export async function findPaymentByGatewayPaymentId(config, paymentId) {
  const c = await getCollection(config);
  return c.findOne({ paymentId });
}

export async function findPaymentsByIds(config, ids) {
  const valid = [...new Set(ids.map(String))].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (valid.length === 0) return [];
  const c = await getCollection(config);
  return c.find({ _id: { $in: valid } }).toArray();
}

export async function listPayments(config, { courseId, status, limit = 100, skip = 0 } = {}) {
  const c = await getCollection(config);
  const query = {};
  if (courseId && ObjectId.isValid(courseId)) query.courseId = new ObjectId(courseId);
  if (status) query.status = status;
  return c.find(query).sort({ createdAt: -1 }).skip(Math.max(skip, 0)).limit(Math.min(Math.max(limit, 1), 200)).toArray();
}

/** Paid seats for a course (used for the optional maxStudents cap). */
export async function countPaidForCourse(config, courseId) {
  const c = await getCollection(config);
  return c.countDocuments({ courseId: new ObjectId(courseId), status: "paid" });
}

/** Any payment record at all (blocks hard-deleting a course that has financial history). */
export async function countPaymentsForCourse(config, courseId) {
  const c = await getCollection(config);
  return c.countDocuments({ courseId: new ObjectId(courseId) });
}

/**
 * Marks an order paid. Only moves forward from created/pending/failed;
 * calling it again for an already-paid order is a no-op (idempotent).
 * Throws 409 if this gateway paymentId is already attached to another order.
 */
export async function markPaid(config, orderId, { paymentId, via }) {
  const c = await getCollection(config);
  const now = new Date();
  try {
    await c.updateOne(
      { orderId, status: { $in: ["created", "pending", "failed"] } },
      { $set: { status: "paid", paymentId, verifiedAt: now, verifiedVia: via, failureCode: null, updatedAt: now } }
    );
  } catch (e) {
    if (e.code === 11000) throw fail("This payment is already linked to another order.", 409, "DUPLICATE_PAYMENT");
    throw e;
  }
  return findPaymentByOrderId(config, orderId);
}

/** Authorized but not yet captured. Never overrides paid/refunded. */
export async function markPending(config, orderId, { paymentId }) {
  const c = await getCollection(config);
  try {
    await c.updateOne(
      { orderId, status: { $in: ["created", "failed"] } },
      { $set: { status: "pending", paymentId, updatedAt: new Date() } }
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
  return findPaymentByOrderId(config, orderId);
}

/** Never overrides paid/refunded — a late failure event for an earlier attempt must not undo a success. */
export async function markFailed(config, orderId, { failureCode } = {}) {
  const c = await getCollection(config);
  await c.updateOne(
    { orderId, status: { $in: ["created", "pending"] } },
    { $set: { status: "failed", failureCode: typeof failureCode === "string" ? failureCode.slice(0, 60) : null, updatedAt: new Date() } }
  );
  return findPaymentByOrderId(config, orderId);
}

export async function markRefunded(config, orderId) {
  const c = await getCollection(config);
  await c.updateOne({ orderId, status: "paid" }, { $set: { status: "refunded", updatedAt: new Date() } });
  return findPaymentByOrderId(config, orderId);
}

/** Admin projection. The claim-token hash is internal and never returned. */
export function toSafePayment(p) {
  if (!p) return null;
  return {
    id: String(p._id),
    courseId: String(p.courseId),
    orderId: p.orderId,
    paymentId: p.paymentId || null,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    gateway: p.gateway,
    verifiedAt: p.verifiedAt || null,
    verifiedVia: p.verifiedVia || null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
