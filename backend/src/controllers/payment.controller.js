import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { enforceRateLimit } from "../middleware/rateLimit.js";
import { jsonSuccess } from "../utils/response.js";
import { timingSafeEqual } from "../utils/password.js";
import { safeParseJson, isValidObjectIdString } from "../utils/validate.js";
import { ORDER_ID_RE, PAYMENT_ID_RE, SIGNATURE_RE, CLAIM_TOKEN_RE, validatePaidEnrollmentInput, normalizeWhatsapp } from "../utils/validate.courses.js";
import { enrollmentGate } from "../utils/courseLifecycle.js";
import { findCourseById, findCoursesByIds, toSafeCourse } from "../services/db/course.service.js";
import {
  createPaymentRecord,
  findPaymentByOrderId,
  findPaymentByGatewayPaymentId,
  countPaidForCourse,
  markPaid,
  markPending,
  markFailed,
  markRefunded,
  listPayments,
  toSafePayment,
} from "../services/db/payment.service.js";
import { findEnrollmentByPaymentId, createEnrollmentFromPayment, findPaidEnrollmentForStudent } from "../services/db/enrollment.service.js";
import {
  getRazorpay,
  createRazorpayOrder,
  fetchRazorpayPayment,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  sha256Hex,
} from "../services/payments/razorpay.service.js";

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

const notFoundOrder = () => fail("Order not found.", 404, "NOT_FOUND");

/**
 * Turns a verified payment into an enrollment. Never throws: the money is already captured, so a failure here
 * must not turn into an error for the student — the status endpoint retries this (it is idempotent).
 */
async function autoEnroll(config, payment) {
  try {
    return await createEnrollmentFromPayment(config, payment);
  } catch (err) {
    console.error("Automatic enrollment failed; it will be retried on the next status check:", err.code || err.message);
    return null;
  }
}

/** Looks up a payment by order id and checks the caller holds its claim token. Generic 404 otherwise. */
export async function findPaymentForClaim(config, orderId, claimToken) {
  if (typeof orderId !== "string" || !ORDER_ID_RE.test(orderId) || typeof claimToken !== "string" || !CLAIM_TOKEN_RE.test(claimToken)) {
    throw notFoundOrder();
  }
  const payment = await findPaymentByOrderId(config, orderId);
  if (!payment || !timingSafeEqual(await sha256Hex(claimToken), payment.claimTokenHash || "")) throw notFoundOrder();
  return payment;
}

/* ----------------------------- public ----------------------------- */

/**
 * POST /api/public/courses/:id/payment/order   { fullName, whatsapp, email }
 * The amount is ALWAYS computed here from the course price in the database — the client cannot choose or
 * change it. This is where enrollment closing is enforced: the check compares the Worker's clock with the
 * stored enrollmentClosesAt, so from that exact instant no new order (and therefore no new payment) can start.
 * (A checkout that was already opened before the deadline may still complete — otherwise someone could be
 * charged without being enrolled — and it enrolls automatically.)
 */
export async function createOrder(request, env, ctx, params) {
  const config = loadConfig(env);
  enforceRateLimit(request, "payment-order", { max: 10 });
  const { keyId } = getRazorpay(config); // 503 until Razorpay secrets are configured

  const body = await safeParseJson(request);
  const inputErrors = validatePaidEnrollmentInput(body);
  if (inputErrors.length > 0) throw fail(inputErrors[0].message, 400, inputErrors[0].code || "INVALID_INPUT");

  const course = isValidObjectIdString(params.id) ? await findCourseById(config, params.id) : null;
  if (!course) throw fail("Course not found.", 404, "NOT_FOUND");
  const closed = enrollmentGate(course, Date.now());
  if (closed) throw fail(closed.message, closed.status, closed.code);
  if (!(typeof course.price === "number" && course.price > 0)) throw fail("This course cannot be purchased online.", 409, "NOT_PURCHASABLE");

  const student = { fullName: body.fullName.trim(), whatsapp: normalizeWhatsapp(body.whatsapp), email: body.email.trim().toLowerCase() };
  if (await findPaidEnrollmentForStudent(config, course._id, student.whatsapp)) {
    throw fail("You are already enrolled in this course with this WhatsApp number.", 409, "ALREADY_ENROLLED");
  }

  if (Number.isInteger(course.maxStudents) && (await countPaidForCourse(config, course._id)) >= course.maxStudents) {
    throw fail("This course is full.", 409, "COURSE_FULL");
  }

  const amount = Math.round(course.price * 100); // paise
  const currency = course.currency || "INR";
  const receipt = `c${String(course._id).slice(-8)}_${Date.now().toString(36)}`; // Razorpay: max 40 chars

  const order = await createRazorpayOrder(config, { amount, currency, receipt, notes: { courseId: String(course._id) } });
  if (!order?.id || !ORDER_ID_RE.test(order.id) || order.amount !== amount) {
    console.error("Unexpected Razorpay order response");
    throw fail("The payment gateway returned an unexpected response.", 502, "PAYMENT_GATEWAY_ERROR");
  }

  // The claim token proves, later, that the enrollment form is being filled by whoever started this order.
  // Only its hash is stored; the token itself goes to the browser once, here.
  const claimToken = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await createPaymentRecord(config, {
    courseId: String(course._id),
    orderId: order.id,
    amount,
    currency,
    receipt,
    claimTokenHash: await sha256Hex(claimToken),
    student,
  });

  return jsonSuccess(
    { orderId: order.id, amount, currency, keyId, claimToken, course: { id: String(course._id), title: course.title } },
    { status: 201, allowedOrigin: config.allowedOrigin }
  );
}

/**
 * POST /api/public/payments/verify  { orderId, paymentId, signature }
 * Verifies Razorpay's signature server-side, cross-checks the payment
 * with Razorpay's API (amount / order / status), and only then marks the
 * payment paid. The browser saying "success" is never trusted.
 */
export async function verify(request, env) {
  const config = loadConfig(env);
  enforceRateLimit(request, "payment-verify", { max: 30 });

  const body = await safeParseJson(request);
  const { orderId, paymentId, signature } = body || {};
  if (!ORDER_ID_RE.test(orderId || "") || !PAYMENT_ID_RE.test(paymentId || "") || !SIGNATURE_RE.test(String(signature || "").toLowerCase())) {
    throw fail("Invalid payment details.", 400, "INVALID_INPUT");
  }

  const payment = await findPaymentByOrderId(config, orderId);
  if (!payment) throw notFoundOrder();
  if (payment.status === "paid" || payment.status === "refunded") {
    const enrollment = payment.status === "paid" ? await autoEnroll(config, payment) : null;
    return jsonSuccess({ status: payment.status, enrolled: !!enrollment }, { allowedOrigin: config.allowedOrigin });
  }

  if (!(await verifyCheckoutSignature(config, { orderId, paymentId, signature }))) {
    throw fail("Payment signature could not be verified.", 400, "INVALID_SIGNATURE");
  }

  // Cross-check with the gateway. If the gateway can't be reached, a valid signature
  // is still proof of a successful payment (the webhook will reconcile later).
  let gatewayPayment = null;
  try {
    gatewayPayment = await fetchRazorpayPayment(config, paymentId);
  } catch (err) {
    console.error("Razorpay payment lookup failed; relying on signature:", err.code || "");
  }

  if (gatewayPayment) {
    if (gatewayPayment.order_id !== orderId || gatewayPayment.amount !== payment.amount || gatewayPayment.currency !== payment.currency) {
      console.error("Payment mismatch for order", orderId);
      throw fail("Payment details do not match this order.", 400, "PAYMENT_MISMATCH");
    }
    if (gatewayPayment.status === "failed") {
      const updated = await markFailed(config, orderId, { failureCode: gatewayPayment.error_code });
      return jsonSuccess({ status: updated.status }, { allowedOrigin: config.allowedOrigin });
    }
    if (gatewayPayment.status !== "captured") {
      const updated = await markPending(config, orderId, { paymentId });
      return jsonSuccess({ status: updated.status }, { allowedOrigin: config.allowedOrigin });
    }
  }

  const updated = await markPaid(config, orderId, { paymentId, via: gatewayPayment ? "api" : "signature" });
  const enrollment = updated.status === "paid" ? await autoEnroll(config, updated) : null;
  return jsonSuccess({ status: updated.status, enrolled: !!enrollment }, { allowedOrigin: config.allowedOrigin });
}

/**
 * POST /api/public/payments/status  { orderId, claimToken }
 * Lets the browser resume after a refresh / closed tab (the webhook may
 * have confirmed the payment in the meantime).
 */
export async function status(request, env) {
  const config = loadConfig(env);
  enforceRateLimit(request, "payment-status", { max: 60 });
  const body = await safeParseJson(request);
  const payment = await findPaymentForClaim(config, body?.orderId, body?.claimToken);
  // A paid payment whose enrollment is missing (e.g. a crash between the two steps) is healed here.
  const enrollment = payment.status === "paid" ? (await findEnrollmentByPaymentId(config, payment._id)) || (await autoEnroll(config, payment)) : null;
  return jsonSuccess(
    { status: payment.status, courseId: String(payment.courseId), enrolled: !!enrollment },
    { allowedOrigin: config.allowedOrigin }
  );
}

/**
 * POST /api/public/payments/webhook   (called by Razorpay, not by browsers)
 * Verifies X-Razorpay-Signature over the RAW body before parsing anything.
 * Idempotent; payment amounts are checked against what we stored when the
 * order was created. Always answers 200 for validly-signed events we don't
 * act on, so Razorpay doesn't retry them forever.
 */
export async function webhook(request, env) {
  const config = loadConfig(env);

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > 256 * 1024) throw fail("Payload too large.", 413, "PAYLOAD_TOO_LARGE");
  const rawBody = await request.text();
  if (rawBody.length > 256 * 1024) throw fail("Payload too large.", 413, "PAYLOAD_TOO_LARGE");

  if (!(await verifyWebhookSignature(config, rawBody, request.headers.get("X-Razorpay-Signature")))) {
    throw fail("Invalid signature.", 400, "INVALID_SIGNATURE");
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { throw fail("Invalid payload.", 400, "INVALID_INPUT"); }

  const ok = () => jsonSuccess({ received: true }, { allowedOrigin: config.allowedOrigin });
  const entity = event?.payload?.payment?.entity;

  switch (event?.event) {
    case "payment.captured":
    case "order.paid": {
      if (!entity || !ORDER_ID_RE.test(entity.order_id || "") || !PAYMENT_ID_RE.test(entity.id || "")) return ok();
      const payment = await findPaymentByOrderId(config, entity.order_id);
      if (!payment) return ok();
      if (entity.amount !== payment.amount || entity.currency !== payment.currency) {
        console.error("Webhook amount mismatch for order", entity.order_id);
        return ok();
      }
      const paid = await markPaid(config, entity.order_id, { paymentId: entity.id, via: "webhook" });
      if (paid?.status === "paid") await autoEnroll(config, paid);
      return ok();
    }
    case "payment.failed": {
      if (!entity || !ORDER_ID_RE.test(entity.order_id || "")) return ok();
      await markFailed(config, entity.order_id, { failureCode: entity.error_code });
      return ok();
    }
    case "refund.processed": {
      const refund = event?.payload?.refund?.entity;
      if (!refund || !PAYMENT_ID_RE.test(refund.payment_id || "")) return ok();
      const payment = await findPaymentByGatewayPaymentId(config, refund.payment_id);
      // Only a full refund flips the status; partial refunds are left to the Razorpay dashboard.
      if (payment && refund.amount >= payment.amount) await markRefunded(config, payment.orderId);
      return ok();
    }
    default:
      return ok();
  }
}

/* ------------------------------ admin ------------------------------ */

/** GET /api/admin/payments?courseId=&status=&page=&limit= */
export async function adminList(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 200);

  const payments = await listPayments(config, {
    courseId: url.searchParams.get("courseId") || undefined,
    status: url.searchParams.get("status") || undefined,
    limit,
    skip: (page - 1) * limit,
  });
  const courses = await findCoursesByIds(config, payments.map((p) => p.courseId));
  const byId = new Map(courses.map((c) => [String(c._id), c]));

  return jsonSuccess(
    {
      payments: payments.map((p) => ({
        ...toSafePayment(p),
        course: byId.get(String(p.courseId)) ? { id: String(p.courseId), title: toSafeCourse(byId.get(String(p.courseId))).title } : null,
      })),
      page,
      limit,
    },
    { allowedOrigin: config.allowedOrigin }
  );
}
