import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { findCategoryById } from "./category.service.js";
import { findTopicById } from "./topic.service.js";
import { normalizeSlug, slugify } from "../../utils/slug.js";
import { validateArticleInput } from "../../utils/validate.js";

/**
 * Data access for the `articles` collection.
 *
 * NOTE: `articles` already exists in the real database (created before
 * this module). This service defines the go-forward document shape
 * required by Phase 2 — it does not migrate or touch any pre-existing
 * documents. If the collection already holds documents in a different
 * shape, reconcile/migrate them before relying on the list/find
 * functions below (see the limitations note in the implementation report).
 *
 * Document shape:
 *   {
 *     _id, categoryId, topicId, title, slug, blocks[], language, status,
 *     authorId, references[] (reference ObjectIds), createdAt, updatedAt,
 *     publishedAt
 *   }
 *
 * References are stored as ObjectId links only — never embedded.
 */

const COLLECTION = "articles";

function throwValidationError(errors) {
  const first = errors[0];
  const err = new Error(typeof first === "string" ? first : first.message);
  err.status = 400;
  err.code = (typeof first === "object" && first.code) || "INVALID_INPUT";
  throw err;
}

function throwNotFound() {
  const err = new Error("Article not found.");
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

function throwCategoryNotFound() {
  const err = new Error("Parent category not found.");
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

function throwTopicNotFound() {
  const err = new Error("Parent topic not found.");
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

function throwTopicCategoryMismatch() {
  const err = new Error("The selected topic does not belong to the selected category.");
  err.status = 400;
  err.code = "INVALID_RELATION";
  throw err;
}

async function getArticlesCollection(config) {
  const db = await getDb(config);
  return db.collection(COLLECTION);
}

/**
 * Indexes support the two query patterns the public/admin APIs will need
 * next: (1) resolving a single article by its URL slug, and (2) listing
 * articles filtered by category/topic/status or by language/status.
 */
export async function ensureArticleIndexes(config) {
  const collection = await getArticlesCollection(config);
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex({ categoryId: 1, topicId: 1, status: 1 });
  await collection.createIndex({ language: 1, status: 1 });
}

export async function createArticle(config, input) {
  const data = {
    ...input,
    slug: normalizeSlug(input.slug || slugify(input.title)),
  };

  const errors = validateArticleInput(data);
  if (errors.length > 0) throwValidationError(errors);

  const category = await findCategoryById(config, data.categoryId);
  if (!category) throwCategoryNotFound();

  if (data.topicId) {
    const topic = await findTopicById(config, data.topicId);
    if (!topic) throwTopicNotFound();
    if (String(topic.categoryId) !== String(data.categoryId)) throwTopicCategoryMismatch();
  }

  const collection = await getArticlesCollection(config);
  const now = new Date();
  const status = data.status || "draft";

  const doc = {
    categoryId: new ObjectId(data.categoryId),
    topicId: data.topicId ? new ObjectId(data.topicId) : null,
    title: data.title.trim(),
    slug: data.slug,
    blocks: data.blocks,
    language: data.language,
    status,
    authorId: new ObjectId(data.authorId),
    references: (data.references || []).map((id) => new ObjectId(id)),
    section: data.section || null,
    excerpt: data.excerpt || null,
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
    coverKey: data.coverKey || null,
    createdAt: now,
    updatedAt: now,
    publishedAt: status === "published" ? now : null,
  };

  try {
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error("An article with this slug already exists.");
      dupErr.status = 409;
      dupErr.code = "DUPLICATE_SLUG";
      throw dupErr;
    }
    throw err;
  }
}

export async function findArticleById(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getArticlesCollection(config);
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function findArticleBySlug(config, slug) {
  const collection = await getArticlesCollection(config);
  return collection.findOne({ slug: normalizeSlug(slug) });
}

/**
 * @param {{ categoryId?: string, topicId?: string, status?: string,
 *   language?: string, limit?: number, skip?: number }} filters
 */
export async function listArticles(config, filters = {}) {
  const collection = await getArticlesCollection(config);
  const query = {};

  if (filters.categoryId && ObjectId.isValid(filters.categoryId)) {
    query.categoryId = new ObjectId(filters.categoryId);
  }
  if (filters.topicId && ObjectId.isValid(filters.topicId)) {
    query.topicId = new ObjectId(filters.topicId);
  }
  if (filters.status) query.status = filters.status;
  if (filters.language) query.language = filters.language;

  const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
  const skip = Math.max(filters.skip || 0, 0);

  return collection
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

export async function updateArticle(config, id, updates) {
  const existing = await findArticleById(config, id);
  if (!existing) throwNotFound();

  const data = { ...updates };
  if (data.slug !== undefined) data.slug = normalizeSlug(data.slug);

  const errors = validateArticleInput(data, { partial: true });
  if (errors.length > 0) throwValidationError(errors);

  if (data.categoryId !== undefined) {
    const category = await findCategoryById(config, data.categoryId);
    if (!category) throwCategoryNotFound();
  }
  if (data.topicId !== undefined && data.topicId !== null) {
    const topic = await findTopicById(config, data.topicId);
    if (!topic) throwTopicNotFound();
    const effectiveCategoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
    if (String(topic.categoryId) !== String(effectiveCategoryId)) throwTopicCategoryMismatch();
  }

  const collection = await getArticlesCollection(config);
  const $set = { updatedAt: new Date() };

  for (const key of ["title", "slug", "blocks", "language", "status", "section", "excerpt", "seoTitle", "seoDescription", "coverKey"]) {
    if (data[key] !== undefined) {
      $set[key] = typeof data[key] === "string" ? data[key].trim() : data[key];
    }
  }
  if (data.categoryId !== undefined) $set.categoryId = new ObjectId(data.categoryId);
  if (data.topicId !== undefined) $set.topicId = data.topicId ? new ObjectId(data.topicId) : null;
  if (data.references !== undefined) $set.references = data.references.map((r) => new ObjectId(r));

  // Moving into "published" for the first time stamps publishedAt.
  if (data.status === "published" && !existing.publishedAt) {
    $set.publishedAt = new Date();
  }

  try {
    await collection.updateOne({ _id: new ObjectId(id) }, { $set });
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error("An article with this slug already exists.");
      dupErr.status = 409;
      dupErr.code = "DUPLICATE_SLUG";
      throw dupErr;
    }
    throw err;
  }

  return findArticleById(config, id);
}

/** Status-based archival — articles are never hard-deleted here. */
export async function archiveArticle(config, id) {
  const existing = await findArticleById(config, id);
  if (!existing) throwNotFound();

  const collection = await getArticlesCollection(config);
  await collection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "archived", updatedAt: new Date() } });
  return findArticleById(config, id);
}

/**
 * Used by reference.service.js's guarded delete: counts how many
 * articles currently cite a given reference, so a reference in active
 * use is never silently deleted out from under an article's citations.
 */
export async function countArticlesUsingReference(config, referenceId) {
  if (!ObjectId.isValid(referenceId)) return 0;
  const collection = await getArticlesCollection(config);
  return collection.countDocuments({ references: new ObjectId(referenceId) });
}

export function toSafeArticle(article) {
  if (!article) return null;
  return {
    id: String(article._id),
    categoryId: String(article.categoryId),
    topicId: article.topicId ? String(article.topicId) : null,
    title: article.title,
    slug: article.slug,
    blocks: article.blocks,
    language: article.language,
    status: article.status,
    authorId: String(article.authorId),
    references: (article.references || []).map((r) => String(r)),
    section: article.section || null,
    excerpt: article.excerpt || null,
    seoTitle: article.seoTitle || null,
    seoDescription: article.seoDescription || null,
    coverKey: article.coverKey || null,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    publishedAt: article.publishedAt || null,
  };
}
