import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { findCategoryById } from "./category.service.js";
import { findTopicById } from "./topic.service.js";
import { normalizeSlug, slugify } from "../../utils/slug.js";
import { validateArticleInput } from "../../utils/validate.js";
import { buildArticleSearchFields, escapeRegex, phoneticFieldRegex, skeletonOf } from "../../utils/searchText.js";
import { HL_LANGS, isHighlightable, normalizeRanges, versionText } from "../../utils/highlights.js";

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
 *     publishedAt, searchTitle, searchText
 *   }
 *
 * `searchTitle` / `searchText` are derived, normalised copies used only by public search (never returned by
 * the API). They are rebuilt on every create/update; articles saved before they existed are filled in by
 * `backfillSearchFields` (scripts/backfill-search.mjs, and a small bounded step on each public search).
 *
 * Text-like blocks may carry `hl` (highlight ranges) - see utils/highlights.js.
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
  // Public listings: newest published first, with a stable _id tie-break.
  await collection.createIndex({ status: 1, publishedAt: -1, _id: -1 });
  await collection.createIndex({ topicId: 1, status: 1, publishedAt: -1 });
}

function throwConflict(message = "This article was changed after you opened it. Reload it before saving so nothing is overwritten.") {
  const err = new Error(message);
  err.status = 409;
  err.code = "CONFLICT";
  throw err;
}

/** Strictly increasing updatedAt, so two saves in the same millisecond still differ (the stale-write guard compares it). */
function nextUpdatedAt(previous) {
  const now = new Date();
  return previous && now.getTime() <= new Date(previous).getTime() ? new Date(new Date(previous).getTime() + 1) : now;
}

function parseBaseUpdatedAt(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error("baseUpdatedAt must be a valid ISO date.");
    err.status = 400;
    err.code = "INVALID_INPUT";
    throw err;
  }
  return d;
}

async function loadReferenceDocs(config, ids = []) {
  const valid = [...new Set(ids.map(String))].filter((id) => ObjectId.isValid(id));
  if (!valid.length) return [];
  const db = await getDb(config);
  return db.collection("references").find({ _id: { $in: valid.map((id) => new ObjectId(id)) } }).project({ book: 1, author: 1, referenceText: 1 }).toArray();
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
    titleTr: data.titleTr || null,
    slug: data.slug,
    blocks: data.blocks,
    language: data.language,
    status,
    authorId: new ObjectId(data.authorId),
    references: (data.references || []).map((id) => new ObjectId(id)),
    excerpt: data.excerpt || null,
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
    coverKey: data.coverKey || null,
    createdAt: now,
    updatedAt: now,
    publishedAt: status === "published" ? now : null,
  };
  Object.assign(doc, buildArticleSearchFields(doc, await loadReferenceDocs(config, data.references || [])));

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

  const baseUpdatedAt = parseBaseUpdatedAt(updates.baseUpdatedAt);
  if (baseUpdatedAt && existing.updatedAt && new Date(existing.updatedAt).getTime() !== baseUpdatedAt.getTime()) throwConflict();

  const collection = await getArticlesCollection(config);
  const $set = { updatedAt: nextUpdatedAt(existing.updatedAt) };

  for (const key of ["title", "titleTr", "slug", "blocks", "language", "status", "excerpt", "seoTitle", "seoDescription", "coverKey"]) {
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

  // Keep the derived search copies in step with whatever changed.
  const touchesSearch = ["title", "titleTr", "blocks", "excerpt", "seoTitle", "seoDescription", "references"].some((k) => data[k] !== undefined);
  if (touchesSearch || existing.searchPhonetic === undefined) {
    const merged = { ...existing, ...$set };
    const refIds = data.references !== undefined ? data.references : (existing.references || []);
    Object.assign($set, buildArticleSearchFields(merged, await loadReferenceDocs(config, refIds)));
  }

  try {
    // With baseUpdatedAt the write only applies if nobody saved in between (compare-and-swap).
    const filter = { _id: new ObjectId(id) };
    if (baseUpdatedAt && existing.updatedAt) filter.updatedAt = existing.updatedAt;
    const res = await collection.updateOne(filter, { $set });
    if (baseUpdatedAt && res.matchedCount === 0) throwConflict();
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

/** Permanently deletes one article. */
export async function deleteArticle(config, id) {
  const existing = await findArticleById(config, id);
  if (!existing) throwNotFound();
  const collection = await getArticlesCollection(config);
  await collection.deleteOne({ _id: new ObjectId(id) });
  return existing; // the caller removes the media files this article used
}

/** Permanently deletes EVERY article. Returns how many were removed. */
export async function deleteAllArticles(config) {
  const collection = await getArticlesCollection(config);
  const all = await collection.find({}).toArray(); // kept only to find their media files afterwards
  const res = await collection.deleteMany({});
  return { count: res.deletedCount, articles: all };
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

/* ----------------------------------------------------------------------------- */
/* Public listings, search, highlights                                            */
/* ----------------------------------------------------------------------------- */

/** Card-sized public shape: no blocks, no search copies, no author. */
export function toListArticle(article) {
  return {
    id: String(article._id),
    categoryId: String(article.categoryId),
    topicId: article.topicId ? String(article.topicId) : null,
    title: article.title,
    titleTr: article.titleTr || null,
    slug: article.slug,
    language: article.language,
    excerpt: article.excerpt || null,
    coverKey: article.coverKey || null,
    createdAt: article.createdAt,
    publishedAt: article.publishedAt || null,
  };
}

const LIST_PROJECTION = { blocks: 0, searchText: 0, searchTitle: 0, searchPhonetic: 0, searchPhoneticTitle: 0, authorId: 0, references: 0, seoTitle: 0, seoDescription: 0 };
// publishedAt is the publication timestamp; legacy articles without one fall back to createdAt.
const SORT_AT = { $addFields: { sortAt: { $ifNull: ["$publishedAt", "$createdAt"] } } };

function clampPaging(page, limit, { maxLimit = 50, defaultLimit = 12 } = {}) {
  const safeLimit = Math.min(Math.max(Number.isInteger(limit) ? limit : defaultLimit, 1), maxLimit);
  const safePage = Math.min(Math.max(Number.isInteger(page) ? page : 1, 1), 10_000);
  return { limit: safeLimit, skip: (safePage - 1) * safeLimit, page: safePage };
}

/**
 * Published articles, newest first, with a deterministic tie-break (_id) so pages never repeat or skip rows
 * that share a timestamp. Always limited to the given (public) categories.
 * `topicId` = direct articles of one folder; `general` = articles with no folder (or whose folder is hidden).
 */
export async function listPublicArticles(config, { categoryIds, topicId, general, hiddenTopicIds = [], language, page, limit } = {}) {
  const paging = clampPaging(page, limit);
  const valid = (categoryIds || []).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (!valid.length) return { articles: [], hasMore: false, page: paging.page, limit: paging.limit };

  const match = { status: "published", categoryId: { $in: valid } };
  if (topicId && ObjectId.isValid(topicId)) match.topicId = new ObjectId(topicId);
  else if (general) match.topicId = { $in: [null, ...hiddenTopicIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))] };
  if (language) match.language = language;

  const collection = await getArticlesCollection(config);
  const rows = await collection
    // Sort right after the match so MongoDB can walk the {status, publishedAt, _id} index; project afterwards.
    .aggregate([{ $match: match }, { $sort: { publishedAt: -1, _id: -1 } }, { $skip: paging.skip }, { $limit: paging.limit + 1 }, { $project: LIST_PROJECTION }])
    .toArray();

  return { articles: rows.slice(0, paging.limit).map(toListArticle), hasMore: rows.length > paging.limit, page: paging.page, limit: paging.limit };
}

/**
 * Public search. Every token must appear in the article's normalised searchText (title, body in every script
 * version, excerpt, SEO text, captions, reference book/author), OR the article sits in one of `folderIds`
 * (folders whose name matched the query, descendants included). Tokens are regex-escaped literals.
 * Title matches rank first, then newest.
 */
export async function searchPublicArticles(config, { tokens, phrase, phonetic = [], categoryIds, folderIds = [], matchedCategoryIds = [], language, page, limit } = {}) {
  const paging = clampPaging(page, limit, { defaultLimit: 12 });
  const valid = (categoryIds || []).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (!valid.length || (!tokens?.length && !phonetic.length)) return { articles: [], hasMore: false, page: paging.page, limit: paging.limit };

  // EVERY query word must be found. A word is found when it appears literally in the normalised text, or - for words
  // with 3+ consonants - when a word of the article has the same consonant skeleton (Roman / Hindi / Urdu spellings
  // of one word meet). Words that match nothing (random speech, "hello babu sahab") therefore return no article.
  const skeletons = tokens.map((t) => skeletonOf(t));
  const tokenClause = (t, i) => {
    const exact = { searchText: { $regex: escapeRegex(t) } };
    const fuzzy = phoneticFieldRegex(skeletons[i]);
    return fuzzy ? { $or: [exact, { searchPhonetic: { $regex: fuzzy } }] } : exact;
  };
  const or = [{ $and: tokens.map(tokenClause) }];
  const folderObjectIds = folderIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const matchedCats = matchedCategoryIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (folderObjectIds.length) or.push({ topicId: { $in: folderObjectIds } });
  if (matchedCats.length) or.push({ categoryId: { $in: matchedCats } });
  const match = { status: "published", categoryId: { $in: valid }, $or: or };
  if (language) match.language = language;

  const has = (field, regex, points) => ({ $cond: [{ $regexMatch: { input: { $ifNull: [`$${field}`, ""] }, regex } }, points, 0] });
  // Ranking: exact title > exact body > sounds-alike title > sounds-alike body.
  const fuzzyKeys = skeletons.map(phoneticFieldRegex).filter(Boolean);
  const score = { $add: [
    has("searchTitle", escapeRegex(phrase || tokens.join(" ")), 200),
    ...tokens.map((t) => has("searchTitle", escapeRegex(t), 20)),
    ...tokens.map((t) => has("searchText", escapeRegex(t), 10)),
    ...fuzzyKeys.flatMap((re) => [has("searchPhoneticTitle", re, 6), has("searchPhonetic", re, 2)]),
  ] };

  const collection = await getArticlesCollection(config);
  const rows = await collection
    .aggregate([
      { $match: match },
      { $addFields: { score } },
      { $project: { ...LIST_PROJECTION } },
      SORT_AT,
      { $sort: { score: -1, sortAt: -1, _id: -1 } },
      { $skip: paging.skip },
      { $limit: paging.limit + 1 },
    ])
    .toArray();

  return { articles: rows.slice(0, paging.limit).map(toListArticle), hasMore: rows.length > paging.limit, page: paging.page, limit: paging.limit };
}

/**
 * Fills searchTitle/searchText for published articles saved before those fields existed. Bounded per call so a
 * single request never does unbounded work; run scripts/backfill-search.mjs once to finish everything.
 */
export async function backfillSearchFields(config, { limit = 25 } = {}) {
  const collection = await getArticlesCollection(config);
  const rows = await collection.find({ searchPhonetic: { $exists: false } }).limit(Math.min(Math.max(limit, 1), 500)).toArray();
  if (!rows.length) return 0;
  const refDocs = await loadReferenceDocs(config, rows.flatMap((a) => a.references || []));
  const refById = new Map(refDocs.map((r) => [String(r._id), r]));
  await collection.bulkWrite(
    rows.map((a) => ({
      updateOne: { filter: { _id: a._id }, update: { $set: buildArticleSearchFields(a, (a.references || []).map((r) => refById.get(String(r))).filter(Boolean)) } },
    })),
    { ordered: false }
  );
  return rows.length;
}

const MAX_HIGHLIGHT_EDITS = 200;

/**
 * Applies highlight edits to existing blocks, addressed by block id (never by text or position).
 * edits: [{ blockId, lang, ranges: [[start, end], ...] }]  - `ranges` REPLACES that block+version's ranges ([] removes them).
 * Only `hl` changes; text, order and every other block are untouched. Compare-and-swap on updatedAt means a
 * stale page can never overwrite a newer save: it gets a 409 instead.
 */
export async function updateBlockHighlights(config, id, { baseUpdatedAt, edits }) {
  const base = parseBaseUpdatedAt(baseUpdatedAt);
  if (!base) {
    const err = new Error("baseUpdatedAt is required.");
    err.status = 400;
    err.code = "INVALID_INPUT";
    throw err;
  }
  if (!Array.isArray(edits) || edits.length === 0 || edits.length > MAX_HIGHLIGHT_EDITS) {
    const err = new Error(`edits must be an array of 1-${MAX_HIGHLIGHT_EDITS} items.`);
    err.status = 400;
    err.code = "INVALID_INPUT";
    throw err;
  }

  const existing = await findArticleById(config, id);
  if (!existing) throwNotFound();
  if (new Date(existing.updatedAt).getTime() !== base.getTime()) throwConflict();

  const bad = (message, code = "INVALID_BLOCK") => {
    const err = new Error(message);
    err.status = 400;
    err.code = code;
    throw err;
  };
  const wellFormed = (r) => Array.isArray(r) && r.length === 2 && Number.isInteger(r[0]) && Number.isInteger(r[1]) && r[0] >= 0 && r[1] > r[0];

  const blocks = (existing.blocks || []).map((b) => ({ ...b, ...(b.hl ? { hl: { ...b.hl } } : {}) }));
  for (const edit of edits) {
    if (!edit || typeof edit.blockId !== "string" || !HL_LANGS.includes(edit.lang) || !Array.isArray(edit.ranges)) bad("Each edit needs blockId, lang and ranges.", "INVALID_INPUT");
    if (!edit.ranges.every(wellFormed)) bad("Highlight ranges must be [start, end] integer pairs with start < end.");
    const block = blocks.find((b) => b.id === edit.blockId);
    if (!block) bad("A highlighted block no longer exists. Reload the article.");
    if (!isHighlightable(block)) bad("That block cannot be highlighted.");

    const length = versionText(block, edit.lang, existing.language).length;
    const ranges = normalizeRanges(edit.ranges); // sorts and merges overlaps
    if (ranges.some(([, e]) => e > length)) bad("A highlight is outside the text. Reload the article.");
    if (ranges.length > 500) bad("Too many highlights in one block.");

    const hl = { ...(block.hl || {}) };
    if (ranges.length) hl[edit.lang] = ranges;
    else delete hl[edit.lang];
    if (Object.keys(hl).length) block.hl = hl;
    else delete block.hl;
  }

  const collection = await getArticlesCollection(config);
  const res = await collection.updateOne({ _id: existing._id, updatedAt: existing.updatedAt }, { $set: { blocks, updatedAt: nextUpdatedAt(existing.updatedAt) } });
  if (res.matchedCount === 0) throwConflict();
  return findArticleById(config, id);
}

export function toSafeArticle(article) {
  if (!article) return null;
  return {
    id: String(article._id),
    categoryId: String(article.categoryId),
    topicId: article.topicId ? String(article.topicId) : null,
    title: article.title,
    titleTr: article.titleTr || null,
    slug: article.slug,
    blocks: article.blocks,
    language: article.language,
    status: article.status,
    authorId: String(article.authorId),
    references: (article.references || []).map((r) => String(r)),
    excerpt: article.excerpt || null,
    seoTitle: article.seoTitle || null,
    seoDescription: article.seoDescription || null,
    coverKey: article.coverKey || null,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    publishedAt: article.publishedAt || null,
  };
}
