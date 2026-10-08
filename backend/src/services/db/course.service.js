import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { normalizeSlug, slugify } from "../../utils/slug.js";
import { parseDateInput } from "../../utils/validate.courses.js";

/**
 * Data access for the `courses` collection.
 *
 * Document shape:
 *   { _id, title, slug, description, shortDescription, teacher, thumbnailKey,
 *     startDate, endDate, price, currency, status, meetingProvider,
 *     meetingLink, maxStudents, isPublished, sortOrder, createdAt, updatedAt }
 *
 * `price` is in major units (rupees); the payment layer converts to
 * paise. `thumbnailKey` follows the existing media convention (a key from
 * POST /api/admin/media, rendered via /api/public/media/:key).
 * `meetingLink` is PRIVATE — it is only ever returned by toSafeCourse
 * (admin) and never by toPublicCourse.
 */

const COLLECTION = "courses";

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

export async function ensureCourseIndexes(config) {
  const c = await getCollection(config);
  await c.createIndex({ slug: 1 }, { unique: true });
  await c.createIndex({ isPublished: 1, status: 1, sortOrder: 1 });
}

export function courseSlugFromInput(input) {
  return normalizeSlug(input.slug || slugify(input.title));
}

const trimOrNull = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const dateOrNull = (v) => {
  const d = parseDateInput(v);
  return d === undefined ? null : d;
};

export async function createCourse(config, input) {
  const now = new Date();
  const doc = {
    title: input.title.trim(),
    slug: input.slug,
    description: typeof input.description === "string" ? input.description.trim() : "",
    shortDescription: typeof input.shortDescription === "string" ? input.shortDescription.trim() : "",
    teacher: trimOrNull(input.teacher),
    thumbnailKey: trimOrNull(input.thumbnailKey),
    startDate: dateOrNull(input.startDate),
    endDate: dateOrNull(input.endDate),
    price: input.price,
    currency: input.currency || "INR",
    status: input.status || "draft",
    meetingProvider: input.meetingProvider || "google_meet",
    meetingLink: trimOrNull(input.meetingLink),
    maxStudents: Number.isInteger(input.maxStudents) ? input.maxStudents : null,
    isPublished: input.isPublished === true && (input.status || "draft") !== "archived",
    sortOrder: Number.isInteger(input.sortOrder) ? input.sortOrder : 0,
    createdAt: now,
    updatedAt: now,
  };

  const c = await getCollection(config);
  try {
    const result = await c.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  } catch (e) {
    if (e.code === 11000) throw fail("A course with this slug already exists.", 409, "DUPLICATE_SLUG");
    throw e;
  }
}

export async function findCourseById(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const c = await getCollection(config);
  return c.findOne({ _id: new ObjectId(id) });
}

export async function findCourseBySlug(config, slug) {
  const c = await getCollection(config);
  return c.findOne({ slug: normalizeSlug(slug) });
}

export async function findCoursesByIds(config, ids) {
  const valid = [...new Set(ids.map(String))].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (valid.length === 0) return [];
  const c = await getCollection(config);
  return c.find({ _id: { $in: valid } }).toArray();
}

/** @param {{ publicOnly?: boolean }} filters */
export async function listCourses(config, { publicOnly = false } = {}) {
  const c = await getCollection(config);
  // Public: published and neither a draft nor archived. (A draft/archived course that was published by mistake still stays hidden.)
  const query = publicOnly ? { isPublished: true, status: { $nin: ["draft", "archived"] } } : {};
  return c.find(query).sort({ sortOrder: 1, startDate: 1, createdAt: -1 }).limit(200).toArray();
}

export async function updateCourse(config, id, updates) {
  const existing = await findCourseById(config, id);
  if (!existing) throw fail("Course not found.", 404, "NOT_FOUND");

  const $set = { updatedAt: new Date() };
  for (const key of ["title", "slug", "description", "shortDescription"]) {
    if (updates[key] !== undefined) $set[key] = typeof updates[key] === "string" ? updates[key].trim() : updates[key];
  }
  for (const key of ["teacher", "thumbnailKey", "meetingLink"]) {
    if (updates[key] !== undefined) $set[key] = trimOrNull(updates[key]);
  }
  for (const key of ["startDate", "endDate"]) {
    if (updates[key] !== undefined) $set[key] = dateOrNull(updates[key]);
  }
  for (const key of ["price", "currency", "status", "meetingProvider", "isPublished", "sortOrder"]) {
    if (updates[key] !== undefined) $set[key] = updates[key];
  }
  // An archived course is never public, whatever isPublished says.
  if (($set.status ?? existing.status) === "archived") $set.isPublished = false;
  if (updates.maxStudents !== undefined) $set.maxStudents = Number.isInteger(updates.maxStudents) ? updates.maxStudents : null;

  const c = await getCollection(config);
  try {
    await c.updateOne({ _id: new ObjectId(id) }, { $set });
  } catch (e) {
    if (e.code === 11000) throw fail("A course with this slug already exists.", 409, "DUPLICATE_SLUG");
    throw e;
  }
  return findCourseById(config, id);
}

/** Takes a course off the public site without deleting it (keeps enrollments / payments intact). */
export async function archiveCourse(config, id) {
  const existing = await findCourseById(config, id);
  if (!existing) throw fail("Course not found.", 404, "NOT_FOUND");
  const c = await getCollection(config);
  await c.updateOne({ _id: new ObjectId(id) }, { $set: { status: "archived", isPublished: false, updatedAt: new Date() } });
  return findCourseById(config, id);
}

/** Bulk ordering update (single bulkWrite) — items: [{ id, ordering }] → sortOrder. Admin-only, low concurrency. */
export async function reorderCourses(config, items) {
  const c = await getCollection(config);
  const now = new Date();
  const ops = items.map(({ id, ordering }) => ({
    updateOne: { filter: { _id: new ObjectId(id) }, update: { $set: { sortOrder: ordering, updatedAt: now } } },
  }));
  const result = await c.bulkWrite(ops, { ordered: false });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

export async function deleteCourse(config, id) {
  const c = await getCollection(config);
  const result = await c.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) throw fail("Course not found.", 404, "NOT_FOUND");
  return { deleted: true };
}

const iso = (d) => (d ? d : null);

/** Admin projection — includes the private meeting link. */
export function toSafeCourse(course) {
  if (!course) return null;
  return {
    id: String(course._id),
    title: course.title,
    slug: course.slug,
    description: course.description || "",
    shortDescription: course.shortDescription || "",
    teacher: course.teacher || null,
    thumbnailKey: course.thumbnailKey || null,
    startDate: iso(course.startDate),
    endDate: iso(course.endDate),
    price: course.price,
    currency: course.currency || "INR",
    status: course.status,
    meetingProvider: course.meetingProvider || "google_meet",
    meetingLink: course.meetingLink || null,
    maxStudents: course.maxStudents ?? null,
    isPublished: !!course.isPublished,
    sortOrder: course.sortOrder ?? 0,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

/** Public projection — NEVER includes meetingLink / meetingProvider / maxStudents. */
export function toPublicCourse(course) {
  if (!course) return null;
  const { meetingLink, meetingProvider, maxStudents, isPublished, sortOrder, ...rest } = toSafeCourse(course);
  return rest;
}
