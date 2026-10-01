import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { findCategoryById } from "./category.service.js";
import { normalizeSlug, slugify } from "../../utils/slug.js";
import { validateTopicInput } from "../../utils/validate.js";

/**
 * Data access for the `topics` collection.
 *
 * Document shape:
 *   { _id, categoryId, title, slug, status, ordering, createdAt, updatedAt }
 *
 * A topic always belongs to a category. Slug uniqueness is scoped to the
 * parent category (two different categories may each have their own
 * "introduction" topic).
 */

const COLLECTION = "topics";

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

async function getTopicsCollection(config) {
  const db = await getDb(config);
  return db.collection(COLLECTION);
}

/** Compound unique index — slug only needs to be unique within its category. */
export async function ensureTopicIndexes(config) {
  const collection = await getTopicsCollection(config);
  await collection.createIndex({ categoryId: 1, slug: 1 }, { unique: true });
}

export async function createTopic(config, input) {
  const data = {
    ...input,
    slug: normalizeSlug(input.slug || slugify(input.title)),
  };

  const errors = validateTopicInput(data);
  if (errors.length > 0) throwValidationError(errors);

  const category = await findCategoryById(config, data.categoryId);
  if (!category) throwNotFound("Parent category");

  const collection = await getTopicsCollection(config);
  const now = new Date();

  const doc = {
    categoryId: new ObjectId(data.categoryId),
    title: data.title.trim(),
    slug: data.slug,
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
      const dupErr = new Error("A topic with this slug already exists in this category.");
      dupErr.status = 409;
      dupErr.code = "DUPLICATE_SLUG";
      throw dupErr;
    }
    throw err;
  }
}

export async function findTopicById(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getTopicsCollection(config);
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function findTopicBySlug(config, categoryId, slug) {
  if (!ObjectId.isValid(categoryId)) return null;
  const collection = await getTopicsCollection(config);
  return collection.findOne({ categoryId: new ObjectId(categoryId), slug: normalizeSlug(slug) });
}

/** @param {{ status?: string }} filters */
export async function listTopicsByCategory(config, categoryId, filters = {}) {
  if (!ObjectId.isValid(categoryId)) return [];
  const collection = await getTopicsCollection(config);
  const query = { categoryId: new ObjectId(categoryId) };
  if (filters.status) query.status = filters.status;

  return collection.find(query).sort({ ordering: 1, createdAt: 1 }).toArray();
}

export async function updateTopic(config, id, updates) {
  const existing = await findTopicById(config, id);
  if (!existing) throwNotFound("Topic");

  const data = { ...updates };
  if (data.slug !== undefined) data.slug = normalizeSlug(data.slug);

  const errors = validateTopicInput(data, { partial: true });
  if (errors.length > 0) throwValidationError(errors);

  if (data.categoryId !== undefined) {
    const category = await findCategoryById(config, data.categoryId);
    if (!category) throwNotFound("Parent category");
  }

  const collection = await getTopicsCollection(config);
  const $set = { updatedAt: new Date() };
  for (const key of ["title", "slug", "status", "ordering"]) {
    if (data[key] !== undefined) $set[key] = typeof data[key] === "string" ? data[key].trim() : data[key];
  }
  if (data.categoryId !== undefined) $set.categoryId = new ObjectId(data.categoryId);

  try {
    await collection.updateOne({ _id: new ObjectId(id) }, { $set });
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error("A topic with this slug already exists in this category.");
      dupErr.status = 409;
      dupErr.code = "DUPLICATE_SLUG";
      throw dupErr;
    }
    throw err;
  }

  return findTopicById(config, id);
}

/** Status-based archival — topics are never hard-deleted here. */
export async function archiveTopic(config, id) {
  const existing = await findTopicById(config, id);
  if (!existing) throwNotFound("Topic");

  const collection = await getTopicsCollection(config);
  await collection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "archived", updatedAt: new Date() } });
  return findTopicById(config, id);
}

/**
 * Bulk ordering update scoped to one category — any item whose id isn't
 * actually a topic of that category is silently skipped (filter won't
 * match), preventing a reorder call from one category corrupting
 * ordering in another.
 */
export async function reorderTopics(config, categoryId, items) {
  const collection = await getTopicsCollection(config);
  const now = new Date();
  const categoryObjectId = new ObjectId(categoryId);

  const ops = items.map(({ id, ordering }) => ({
    updateOne: {
      filter: { _id: new ObjectId(id), categoryId: categoryObjectId },
      update: { $set: { ordering, updatedAt: now } },
    },
  }));

  const result = await collection.bulkWrite(ops, { ordered: false });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

export function toSafeTopic(topic) {
  if (!topic) return null;
  return {
    id: String(topic._id),
    categoryId: String(topic.categoryId),
    title: topic.title,
    slug: topic.slug,
    status: topic.status,
    ordering: topic.ordering,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
  };
}
