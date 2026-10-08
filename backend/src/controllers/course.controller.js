import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson, isValidObjectIdString, validateReorderInput } from "../utils/validate.js";
import { validateCourseInput } from "../utils/validate.courses.js";
import { normalizeSlug } from "../utils/slug.js";
import {
  createCourse,
  findCourseById,
  findCourseBySlug,
  listCourses,
  updateCourse,
  archiveCourse,
  reorderCourses,
  deleteCourse,
  courseSlugFromInput,
  toSafeCourse,
  toPublicCourse,
} from "../services/db/course.service.js";
import { countPaymentsForCourse } from "../services/db/payment.service.js";

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function throwValidation(errors) {
  throw fail(errors[0].message, 400, errors[0].code || "INVALID_INPUT");
}

/** Enrollment can only be opened for a course that can actually be paid for. */
function assertOpenable(merged) {
  if (merged.status === "enrollment_open" && !(typeof merged.price === "number" && merged.price > 0)) {
    throw fail("Set a price above 0 before opening enrollment (online payment is required).", 400, "INVALID_INPUT");
  }
}

/* ----------------------------- public ----------------------------- */

/** GET /api/public/courses — published courses (not draft / archived); never includes the meeting link. */
export async function publicList(request, env) {
  const config = loadConfig(env);
  const courses = await listCourses(config, { publicOnly: true });
  return jsonSuccess({ courses: courses.map(toPublicCourse) }, { allowedOrigin: config.allowedOrigin });
}

/** GET /api/public/courses/:slug — unpublished / draft / archived respond exactly like a missing course. */
export async function publicBySlug(request, env, ctx, params) {
  const config = loadConfig(env);
  const course = await findCourseBySlug(config, params.slug);
  if (!course || !course.isPublished || course.status === "draft" || course.status === "archived") throw fail("Not found.", 404, "NOT_FOUND");
  return jsonSuccess({ course: toPublicCourse(course) }, { allowedOrigin: config.allowedOrigin });
}

/* ------------------------------ admin ------------------------------ */

export async function adminList(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const courses = await listCourses(config);
  return jsonSuccess({ courses: courses.map(toSafeCourse) }, { allowedOrigin: config.allowedOrigin });
}

export async function adminGet(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const course = isValidObjectIdString(params.id) ? await findCourseById(config, params.id) : null;
  if (!course) throw fail("Course not found.", 404, "NOT_FOUND");
  return jsonSuccess({ course: toSafeCourse(course) }, { allowedOrigin: config.allowedOrigin });
}

export async function adminCreate(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const body = await safeParseJson(request);
  if (!body) throw fail("Request body must be valid JSON.", 400, "INVALID_INPUT");

  const data = { ...body, slug: courseSlugFromInput(body) };
  const errors = validateCourseInput(data);
  if (errors.length > 0) throwValidation(errors);
  assertOpenable(data);

  const course = await createCourse(config, data);
  return jsonSuccess({ course: toSafeCourse(course) }, { status: 201, allowedOrigin: config.allowedOrigin });
}

export async function adminUpdate(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const body = await safeParseJson(request);
  if (!body) throw fail("Request body must be valid JSON.", 400, "INVALID_INPUT");

  const existing = isValidObjectIdString(params.id) ? await findCourseById(config, params.id) : null;
  if (!existing) throw fail("Course not found.", 404, "NOT_FOUND");

  const data = { ...body };
  if (data.slug !== undefined) data.slug = normalizeSlug(data.slug);
  const errors = validateCourseInput(data, { partial: true });
  if (errors.length > 0) throwValidation(errors);
  assertOpenable({ status: data.status ?? existing.status, price: data.price ?? existing.price });

  const course = await updateCourse(config, params.id, data);
  return jsonSuccess({ course: toSafeCourse(course) }, { allowedOrigin: config.allowedOrigin });
}

/** POST /api/admin/courses/:id/archive — hides the course from the public site; nothing is deleted. */
export async function adminArchive(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  if (!isValidObjectIdString(params.id)) throw fail("Course not found.", 404, "NOT_FOUND");
  const course = await archiveCourse(config, params.id);
  return jsonSuccess({ course: toSafeCourse(course) }, { allowedOrigin: config.allowedOrigin });
}

/** POST /api/admin/courses/reorder  { items: [{ id, ordering }] } — same contract as categories/topics. */
export async function adminReorder(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const body = await safeParseJson(request);
  const errors = validateReorderInput(body);
  if (errors.length > 0) throwValidation(errors);
  if (body.items.some((i) => !Number.isInteger(i.ordering) || Math.abs(i.ordering) > 100000)) {
    throw fail("ordering must be a whole number.", 400, "INVALID_INPUT");
  }
  const result = await reorderCourses(config, body.items);
  return jsonSuccess({ reordered: result }, { allowedOrigin: config.allowedOrigin });
}

/** A course with any payment history can't be hard-deleted — unpublish or mark it completed instead. */
export async function adminRemove(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  if (!isValidObjectIdString(params.id)) throw fail("Course not found.", 404, "NOT_FOUND");
  if ((await countPaymentsForCourse(config, params.id)) > 0) {
    throw fail("This course has payment records and cannot be deleted. Unpublish it or mark it completed instead.", 409, "HAS_PAYMENTS");
  }
  const result = await deleteCourse(config, params.id);
  return jsonSuccess(result, { allowedOrigin: config.allowedOrigin });
}
