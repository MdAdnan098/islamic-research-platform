import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { normalizeSlug, slugify } from "../../utils/slug.js";
import { validateCategoryInput } from "../../utils/validate.js";

/**
 * Data access for the `categories` collection.
 *
 * Document shape:
 *   { _id, name, slug, description, type, status, ordering, createdAt, updatedAt }
 *
 * `type` is one of CATEGORY_TYPES (the platform's top-level research
 * sections, e.g. "aqeedah" | "masail" — see utils/contentEnums.js).
 */

const COLLECTION = "categories";

function throwValidationError(errors) {
  const first = errors[0];
  const err = new Error(typeof first === "string" ? first : first.message);
  err.status = 400;
  err.code = (typeof first === "object" && first.code) || "INVALID_INPUT";
  throw err;
}

function throwNotFound(what) {
  const err = new Error(`${what} not found.`);
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

async function getCategoriesCollection(config) {
  const db = await getDb(config);
  return db.collection(COLLECTION);
}

/** Unique slug index — a category's slug is its public-facing identifier. */
export async function ensureCategoryIndexes(config) {
  const collection = await getCategoriesCollection(config);
  await collection.createIndex({ slug: 1 }, { unique: true });
}

export async function createCategory(config, input) {
  const data = {
    ...input,
    slug: normalizeSlug(input.slug || slugify(input.name)),
  };

  const errors = validateCategoryInput(data);
  if (errors.length > 0) throwValidationError(errors);

  const collection = await getCategoriesCollection(config);
  const now = new Date();

  const doc = {
    name: data.name.trim(),
    slug: data.slug,
    description: data.description?.trim() || null,
    type: data.type,
    status: data.status || "active",
    ordering: typeof data.ordering === "number" ? data.ordering : 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error("A category with this slug already exists.");
      dupErr.status = 409;
      dupErr.code = "DUPLICATE_SLUG";
      throw dupErr;
    }
    throw err;
  }
}

export async function findCategoryById(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCategoriesCollection(config);
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function findCategoryBySlug(config, slug) {
  const collection = await getCategoriesCollection(config);
  return collection.findOne({ slug: normalizeSlug(slug) });
}

/** @param {{ status?: string, type?: string }} filters */
export async function listCategories(config, filters = {}) {
  const collection = await getCategoriesCollection(config);
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;

  return collection.find(query).sort({ ordering: 1, createdAt: 1 }).toArray();
}

export async function updateCategory(config, id, updates) {
  const existing = await findCategoryById(config, id);
  if (!existing) throwNotFound("Category");

  const data = { ...updates };
  if (data.slug !== undefined) data.slug = normalizeSlug(data.slug);

  const errors = validateCategoryInput(data, { partial: true });
  if (errors.length > 0) throwValidationError(errors);

  const collection = await getCategoriesCollection(config);
  const $set = { updatedAt: new Date() };
  for (const key of ["name", "slug", "description", "type", "status", "ordering"]) {
    if (data[key] !== undefined) $set[key] = typeof data[key] === "string" ? data[key].trim() : data[key];
  }

  try {
    await collection.updateOne({ _id: new ObjectId(id) }, { $set });
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error("A category with this slug already exists.");
      dupErr.status = 409;
      dupErr.code = "DUPLICATE_SLUG";
      throw dupErr;
    }
    throw err;
  }

  return findCategoryById(config, id);
}

/** Status-based archival — categories are never hard-deleted here. */
export async function archiveCategory(config, id) {
  const existing = await findCategoryById(config, id);
  if (!existing) throwNotFound("Category");

  const collection = await getCategoriesCollection(config);
  await collection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "archived", updatedAt: new Date() } });
  return findCategoryById(config, id);
}

/**
 * Bulk ordering update via a single bulkWrite — avoids N sequential
 * round-trips. Not a multi-document transaction (Workers/Atlas free-tier
 * friendly, no distributed locking) — acceptable here since this is a
 * low-concurrency, admin-only operation, not a public write path.
 */
export async function reorderCategories(config, items) {
  const collection = await getCategoriesCollection(config);
  const now = new Date();

  const ops = items.map(({ id, ordering }) => ({
    updateOne: {
      filter: { _id: new ObjectId(id) },
      update: { $set: { ordering, updatedAt: now } },
    },
  }));

  const result = await collection.bulkWrite(ops, { ordered: false });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

export function toSafeCategory(category) {
  if (!category) return null;
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    description: category.description || null,
    type: category.type,
    status: category.status,
    ordering: category.ordering,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
