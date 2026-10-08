import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { enforceRateLimit } from "../middleware/rateLimit.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson, isValidObjectIdString } from "../utils/validate.js";
import { validateEnrollmentInput, validateEnrollmentUpdate } from "../utils/validate.courses.js";
import { findCourseById, findCoursesByIds } from "../services/db/course.service.js";
import { findPaymentsByIds } from "../services/db/payment.service.js";
import { ENROLLMENT_PAYMENT_STATUSES, ENROLLMENT_STATUSES } from "../utils/courseEnums.js";
import {
  createEnrollment,
  createEnrollmentFromPayment,
  createEnrollmentRequest,
  countApprovedForCourse,
  findEnrollmentById,
  findEnrollmentByPaymentId,
  listEnrollments,
  updateEnrollment,
  toSafeEnrollment,
} from "../services/db/enrollment.service.js";
import { findPaymentForClaim } from "./payment.controller.js";
import { enrollmentGate, isPubliclyVisible, studentSessions, studentNextChangeAt, computeLifecycle } from "../utils/courseLifecycle.js";

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
 * Legacy "pay first, fill the form after" step. New payments carry the student's details from the order and are
 * enrolled automatically on verification, so this is only needed for an older payment that was paid but never
 * enrolled. The enrollment is accepted ONLY if the stored payment for that order is `paid` — a status that only
 * server-side signature / gateway / webhook verification can set. Money is already taken here, so the closing
 * time does not apply. The enrollment is created as approved (no admin approval step).
 */
export async function enroll(request, env, ctx, params) {
  const config = loadConfig(env);
  enforceRateLimit(request, "enroll", { max: 15 });

  const body = await safeParseJson(request);
  if (!body) throw fail("Request body must be valid JSON.", 400, "INVALID_INPUT");

  if (!isValidObjectIdString(params.id)) throw fail("Course not found.", 404, "NOT_FOUND");

  const payment = await findPaymentForClaim(config, body.orderId, body.claimToken);
  // Details given before payment win; the form body is only needed for older payments that have none.
  if (!payment.student) {
    const errors = validateEnrollmentInput(body);
    if (errors.length > 0) throw fail(errors[0].message, 400, errors[0].code || "INVALID_INPUT");
  }
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

  if (payment.student) await createEnrollmentFromPayment(config, payment);
  else await createEnrollment(config, { courseId: params.id, paymentId: String(payment._id), fullName: body.fullName, whatsapp: body.whatsapp, email: body.email });

  // Never returns a meeting link — the student gets it from POST /courses/:id/access at class time.
  return jsonSuccess({ enrolled: true, course: { title: course.title } }, { status: 201, allowedOrigin: config.allowedOrigin });
}

/**
 * POST /api/public/courses/:id/enrollment-request  { fullName, whatsapp, email? }
 *
 * Creates a PENDING / UNPAID enrollment request. The body can't carry a status or payment field - the
 * server sets both (and ignores anything else sent). Nothing identifying the record is returned, and
 * there is no public endpoint to read or change enrollments.
 */
export async function requestEnrollment(request, env, ctx, params) {
  const config = loadConfig(env);
  enforceRateLimit(request, "enrollment-request", { max: 10 });

  const body = await safeParseJson(request);
  if (!body) throw fail("Request body must be valid JSON.", 400, "INVALID_INPUT");
  const errors = validateEnrollmentInput(body);
  if (errors.length > 0) throw fail(errors[0].message, 400, errors[0].code || "INVALID_INPUT");

  const course = isValidObjectIdString(params.id) ? await findCourseById(config, params.id) : null;
  if (!course) throw fail("Course not found.", 404, "NOT_FOUND");
  const closed = enrollmentGate(course, Date.now()); // same timestamp-based gate as paid enrollment
  if (closed) throw fail(closed.message, closed.status, closed.code);
  if (Number.isInteger(course.maxStudents) && (await countApprovedForCourse(config, params.id)) >= course.maxStudents) {
    throw fail("This course is full.", 409, "COURSE_FULL");
  }

  await createEnrollmentRequest(config, { courseId: params.id, fullName: body.fullName, whatsapp: body.whatsapp, email: body.email });
  return jsonSuccess({ requested: true, course: { title: course.title } }, { status: 201, allowedOrigin: config.allowedOrigin });
}

/**
 * POST /api/public/courses/:id/access  { orderId, claimToken }
 *
 * The student-access mechanism that needs no login: the claim token the browser received when it started the
 * paid order proves who paid. Only a PAID payment with an enrollment gets anything, and a Meet link is returned
 * only for a class that is live or about to start (see studentSessions) — never for completed classes, never
 * on the public course endpoints.
 */
export async function access(request, env, ctx, params) {
  const config = loadConfig(env);
  enforceRateLimit(request, "course-access", { max: 60 });
  const body = await safeParseJson(request);
  if (!isValidObjectIdString(params.id)) throw fail("Course not found.", 404, "NOT_FOUND");

  const payment = await findPaymentForClaim(config, body?.orderId, body?.claimToken);
  if (String(payment.courseId) !== params.id || payment.status !== "paid") throw fail("Order not found.", 404, "NOT_FOUND");
  const enrollment = (await findEnrollmentByPaymentId(config, payment._id)) || (await createEnrollmentFromPayment(config, payment));
  if (!enrollment || !["approved", "confirmed"].includes(enrollment.status)) throw fail("Order not found.", 404, "NOT_FOUND");

  const course = await findCourseById(config, params.id);
  const now = Date.now();
  if (!course || !isPubliclyVisible(course, now)) throw fail("This course is no longer available.", 404, "NOT_FOUND");

  const lifecycle = computeLifecycle(course, now);
  return jsonSuccess(
    {
      enrolled: true,
      serverTime: new Date(now).toISOString(),
      course: { title: course.title, phase: lifecycle.phase, label: lifecycle.label },
      sessions: studentSessions(course, now),
      nextChangeAt: studentNextChangeAt(course, now) || lifecycle.nextTransitionAt,
    },
    { allowedOrigin: config.allowedOrigin, headers: { "Cache-Control": "no-store" } }
  );
}

/* ------------------------------ admin ------------------------------ */

async function withRelations(config, enrollments) {
  const [courses, payments] = await Promise.all([
    findCoursesByIds(config, enrollments.map((e) => e.courseId)),
    findPaymentsByIds(config, enrollments.map((e) => e.paymentId).filter(Boolean)),
  ]);
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const paymentById = new Map(payments.map((p) => [String(p._id), p]));
  return enrollments.map((e) => toSafeEnrollment(e, { course: courseById.get(String(e.courseId)), payment: e.paymentId ? paymentById.get(String(e.paymentId)) : undefined }));
}

/** GET /api/admin/enrollments?courseId=&status=&paymentStatus=&includeUnpaid=1&q=&page=&limit= — paid enrollments by default; contains private student data. */
export async function adminList(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 200);

  const status = url.searchParams.get("status") || undefined;
  const paymentStatus = url.searchParams.get("paymentStatus") || undefined;
  const courseId = url.searchParams.get("courseId") || undefined;
  if (status && !ENROLLMENT_STATUSES.includes(status)) throw fail("Invalid status filter.", 400, "INVALID_INPUT");
  if (paymentStatus && !ENROLLMENT_PAYMENT_STATUSES.includes(paymentStatus)) throw fail("Invalid paymentStatus filter.", 400, "INVALID_INPUT");
  if (courseId && !isValidObjectIdString(courseId)) throw fail("Invalid courseId filter.", 400, "INVALID_INPUT");

  const includeUnpaid = url.searchParams.get("includeUnpaid") === "1";
  const enrollments = await listEnrollments(config, { courseId, status, paymentStatus, includeUnpaid, q: url.searchParams.get("q") || undefined, limit, skip: (page - 1) * limit });
  return jsonSuccess({ enrollments: await withRelations(config, enrollments), page, limit }, { allowedOrigin: config.allowedOrigin });
}

/** GET /api/admin/enrollments/:id */
export async function adminGet(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const found = isValidObjectIdString(params.id) ? await findEnrollmentById(config, params.id) : null;
  if (!found) throw fail("Enrollment not found.", 404, "NOT_FOUND");
  const [enrollment] = await withRelations(config, [found]);
  return jsonSuccess({ enrollment }, { allowedOrigin: config.allowedOrigin });
}

/** PATCH /api/admin/enrollments/:id  { status?, meetLinkSent? } */
export async function adminUpdate(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  if (!isValidObjectIdString(params.id)) throw fail("Enrollment not found.", 404, "NOT_FOUND");

  const body = await safeParseJson(request);
  const errors = validateEnrollmentUpdate(body);
  if (errors.length > 0) throw fail(errors[0].message, 400, errors[0].code || "INVALID_INPUT");

  // Approving takes a seat: respect the course's maxStudents.
  if (body.status === "approved") {
    const current = await findEnrollmentById(config, params.id);
    const course = current ? await findCourseById(config, current.courseId) : null;
    const alreadyApproved = current && (current.status === "approved" || current.status === "confirmed");
    if (course && !alreadyApproved && Number.isInteger(course.maxStudents) && (await countApprovedForCourse(config, current.courseId)) >= course.maxStudents) {
      throw fail("This course is full. Increase max students or reject/cancel another enrollment first.", 409, "COURSE_FULL");
    }
  }

  const updated = await updateEnrollment(config, params.id, body);
  const [enrollment] = await withRelations(config, [updated]);
  return jsonSuccess({ enrollment }, { allowedOrigin: config.allowedOrigin });
}
