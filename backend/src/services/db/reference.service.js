import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { validateReferenceInput } from "../../utils/validate.js";
import { countArticlesUsingReference } from "./article.service.js";

/**
 * Data access for the `references` collection.
 *
 * Document shape:
 *   { _id, book, author, volume, page, referenceText, mediaKey, createdAt, updatedAt }
 *
 * References are reusable, standalone documents — articles link to them
 * by ObjectId (article.references[]) rather than embedding them. No
 * delete function is exposed in this module: removing a reference that
 * an article still points to would silently break that article's
 * citations, and the spec calls for status-based archival over hard
 * deletes elsewhere in this data model. A guarded delete (checking for
 * existing references from articles first) can be added alongside the
 * article API in the next module if genuinely needed.
 *
 * `mediaKey` is stored as a plain string (a future R2 object key) —
 * no R2 access happens in this module.
 */

const COLLECTION = "references";

function throwValidationError(errors) {
  const first = errors[0];
  const err = new Error(typeof first === "string" ? first : first.message);
  err.status = 400;
  err.code = (typeof first === "object" && first.code) || "INVALID_INPUT";
  throw err;
}

function throwNotFound() {
  const err = new Error("Reference not found.");
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

async function getReferencesCollection(config) {
  const db = await getDb(config);
  return db.collection(COLLECTION);
}

/**
 * Non-unique lookup index on (book, author) — supports the admin
 * "find an existing reference before creating a duplicate" search.
 * No uniqueness constraint: the same book/author legitimately appears
 * across many distinct reference entries (different volumes/pages).
 */
export async function ensureReferenceIndexes(config) {
  const collection = await getReferencesCollection(config);
  await collection.createIndex({ book: 1, author: 1 });
}

export async function createReference(config, input) {
  const errors = validateReferenceInput(input);
  if (errors.length > 0) throwValidationError(errors);

  const collection = await getReferencesCollection(config);
  const now = new Date();

  const doc = {
    book: input.book.trim(),
    author: input.author?.trim() || null,
    volume: input.volume?.trim() || null,
    page: input.page?.trim() || null,
    referenceText: input.referenceText?.trim() || null,
    mediaKey: input.mediaKey?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function findReferenceById(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getReferencesCollection(config);
  return collection.findOne({ _id: new ObjectId(id) });
}

/**
 * Resolves multiple reference ids at once (used when rendering an
 * article's references[] list). Silently skips invalid/missing ids.
 */
export async function findReferencesByIds(config, ids = []) {
  const validIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (validIds.length === 0) return [];

  const collection = await getReferencesCollection(config);
  return collection.find({ _id: { $in: validIds } }).toArray();
}

/** @param {{ book?: string, author?: string, limit?: number }} filters */
export async function listReferences(config, filters = {}) {
  const collection = await getReferencesCollection(config);
  const query = {};
  if (filters.book) query.book = { $regex: escapeRegExp(filters.book), $options: "i" };
  if (filters.author) query.author = { $regex: escapeRegExp(filters.author), $options: "i" };

  const limit = Math.min(Math.max(filters.limit || 50, 1), 200);
  return collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function updateReference(config, id, updates) {
  const existing = await findReferenceById(config, id);
  if (!existing) throwNotFound();

  const errors = validateReferenceInput(updates, { partial: true });
  if (errors.length > 0) throwValidationError(errors);

  const collection = await getReferencesCollection(config);
  const $set = { updatedAt: new Date() };
  for (const key of ["book", "author", "volume", "page", "referenceText", "mediaKey"]) {
    if (updates[key] !== undefined) {
      $set[key] = typeof updates[key] === "string" ? updates[key].trim() : updates[key];
    }
  }

  await collection.updateOne({ _id: new ObjectId(id) }, { $set });
  return findReferenceById(config, id);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Guarded delete: a reference currently cited by any article is never
 * hard-deleted (that would silently break that article's citation).
 * Archiving isn't used here — the Reference schema has no status field
 * by design (see Module 1) — so "safe to delete" is enforced by usage
 * check instead.
 */
export async function deleteReference(config, id) {
  const existing = await findReferenceById(config, id);
  if (!existing) throwNotFound();

  const usageCount = await countArticlesUsingReference(config, id);
  if (usageCount > 0) {
    const err = new Error(
      `This reference is cited by ${usageCount} article(s) and cannot be deleted.`
    );
    err.status = 409;
    err.code = "REFERENCE_IN_USE";
    throw err;
  }

  const collection = await getReferencesCollection(config);
  await collection.deleteOne({ _id: new ObjectId(id) });
  return true;
}

export function toSafeReference(reference) {
  if (!reference) return null;
  return {
    id: String(reference._id),
    book: reference.book,
    author: reference.author || null,
    volume: reference.volume || null,
    page: reference.page || null,
    referenceText: reference.referenceText || null,
    mediaKey: reference.mediaKey || null,
    createdAt: reference.createdAt,
    updatedAt: reference.updatedAt,
  };
}
