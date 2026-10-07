import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { enforceRateLimit } from "../middleware/rateLimit.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson, isValidObjectIdString } from "../utils/validate.js";
import { validateEnrollmentInput, validateEnrollmentUpdate } from "../utils/validate.courses.js";
import { findCourseById, findCoursesByIds } from "../services/db/course.service.js";
import { findPaymentsByIds } from "../services/db/payment.service.js";
import {
  createEnrollment,
  findEnrollmentByPaymentId,
  listEnrollments,
  updateEnrollment,
  toSafeEnrollment,
} from "../services/db/enrollment.service.js";
import { findPaymentForClaim } from "./payment.controller.js";

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * POST /api/public/courses/:id/enroll
 *   { orderId, claimToken, fullName, whatsapp, email? }
 *
 * The enrollment is accepted ONLY if the stored payment for that order is
 * `paid` — a status that only server-side signature / gateway / webhook
 * verification can set. Nothing the browser sends can make it true.
 */
export async function enroll(request, env, ctx, params) {
  const config = loadConfig(env);
  enforceRateLimit(request, "enroll", { max: 15 });

  const body = await safeParseJson(request);
  if (!body) throw fail("Request body must be valid JSON.", 400, "INVALID_INPUT");

  const errors = validateEnrollmentInput(body);
  if (errors.length > 0) throw fail(errors[0].message, 400, errors[0].code || "INVALID_INPUT");
  if (!isValidObjectIdString(params.id)) throw fail("Course not found.", 404, "NOT_FOUND");

  const payment = await findPaymentForClaim(config, body.orderId, body.claimToken);
  if (String(payment.courseId) !== params.id) throw fail("Order not found.", 404, "NOT_FOUND");
  if (payment.status !== "paid") {
    throw fail("Your payment has not been confirmed yet. Please wait a moment and try again.", 402, "PAYMENT_NOT_VERIFIED");
  }

  const course = await findCourseById(config, params.id);
  if (!course) throw fail("Course not found.", 404, "NOT_FOUND");

  // Application-level check; the unique index on enrollments.paymentId (created by
  // `npm run bootstrap:indexes`) additionally closes the race between two simultaneous submits.
  if (await findEnrollmentByPaymentId(config, payment._id)) {
    throw fail("An enrollment has already been submitted for this payment.", 409, "ALREADY_ENROLLED");
  }

  await createEnrollment(config, {
    courseId: params.id,
    paymentId: String(payment._id),
    fullName: body.fullName,
    whatsapp: body.whatsapp,
    email: body.email,
  });

  // Deliberately returns no meeting link — the admin sends it manually for now.
  return jsonSuccess({ enrolled: true, course: { title: course.title } }, { status: 201, allowedOrigin: config.allowedOrigin });
}

/* ------------------------------ admin ------------------------------ */

/** GET /api/admin/enrollments?courseId=&status=&page=&limit= — contains private student data. */
export async function adminList(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 200);

  const enrollments = await listEnrollments(config, {
    courseId: url.searchParams.get("courseId") || undefined,
    status: url.searchParams.get("status") || undefined,
    limit,
    skip: (page - 1) * limit,
  });

  const [courses, payments] = await Promise.all([
    findCoursesByIds(config, enrollments.map((e) => e.courseId)),
    findPaymentsByIds(config, enrollments.map((e) => e.paymentId)),
  ]);
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const paymentById = new Map(payments.map((p) => [String(p._id), p]));

  return jsonSuccess(
    {
      enrollments: enrollments.map((e) =>
        toSafeEnrollment(e, { course: courseById.get(String(e.courseId)), payment: paymentById.get(String(e.paymentId)) })
      ),
      page,
      limit,
    },
    { allowedOrigin: config.allowedOrigin }
  );
}

/** PATCH /api/admin/enrollments/:id  { status?, meetLinkSent? } */
export async function adminUpdate(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  if (!isValidObjectIdString(params.id)) throw fail("Enrollment not found.", 404, "NOT_FOUND");

  const body = await safeParseJson(request);
  const errors = validateEnrollmentUpdate(body);
  if (errors.length > 0) throw fail(errors[0].message, 400, errors[0].code || "INVALID_INPUT");

  const updated = await updateEnrollment(config, params.id, body);
  return jsonSuccess({ enrollment: toSafeEnrollment(updated) }, { allowedOrigin: config.allowedOrigin });
}
