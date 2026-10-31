import { invalidatePublicCache } from "../../utils/publicCache.js";
import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";
import { findCategoryById } from "./category.service.js";
import { normalizeSlug, slugify } from "../../utils/slug.js";
import { validateTopicInput } from "../../utils/validate.js";
import { checkParentChange, hasSiblingWithTitle, indexFolders, descendantIds, deletionPlan } from "../../utils/folderTree.js";

/**
 * Data access for the `topics` collection. A topic IS a "folder" in the public UI.
 *
 * Document shape:
 *   { _id, categoryId, parentId|null, title, slug, status, ordering, createdAt, updatedAt }
 *
 * A topic always belongs to a category (the Aqaid / Masail section lives on the category). `parentId` nests a
 * folder inside another folder of the SAME category; documents written before nesting existed have no
 * `parentId` and are root folders. Slug uniqueness is scoped to the parent category (unchanged), which also
 * means a folder's public URL never depends on where it sits in the tree, and moving a folder can never
 * cause a slug clash.
 *
 * Folders are never "archived" any more: deleting one re-parents its subfolders and articles (see deleteTopic).
 * `status: "archived"` is still read, so legacy archived folders stay hidden publicly.
 */

const COLLECTION = "topics";
/** How many folders can be pinned to the homepage at once. */
export const HOME_PIN_LIMIT = 3;

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
  await collection.createIndex({ categoryId: 1, parentId: 1, ordering: 1 });
}

/** Every topic (optionally limited to some categories / a status), for tree computations. Folder counts are small. */
export async function listAllTopics(config, { categoryIds, status } = {}) {
  const collection = await getTopicsCollection(config);
  const query = {};
  if (categoryIds) query.categoryId = { $in: categoryIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) };
  if (status) query.status = status;
  return collection.find(query).sort({ ordering: 1, createdAt: 1, _id: 1 }).limit(5000).toArray();
}

function throwConflict(message, code) {
  const err = new Error(message);
  err.status = 409;
  err.code = code;
  throw err;
}

/** Validates a parent choice; a parent that exists but sits in another category is a relation error, not "not found". */
async function assertParentUsable(config, { folderId = null, parentId, categoryId, all }) {
  if (!parentId) return;
  if (!all.some((t) => String(t._id) === String(parentId))) {
    const elsewhere = await findTopicById(config, parentId);
    throwRelation(elsewhere
      ? { code: "INVALID_RELATION", message: "The parent folder belongs to a different section/category." }
      : { code: "NOT_FOUND", message: "Parent folder not found." });
  }
  const check = checkParentChange({ folderId, newParentId: parentId, categoryId, folders: all });
  if (!check.ok) throwRelation(check);
}

function throwRelation(check) {
  const err = new Error(check.message);
  err.status = check.code === "NOT_FOUND" ? 404 : 400;
  err.code = check.code;
  throw err;
}

export async function createTopic(config, input) {
  invalidatePublicCache();
  const data = {
    ...input,
    slug: normalizeSlug(input.slug || slugify(input.title)),
  };

  const errors = validateTopicInput(data);
  if (errors.length > 0) throwValidationError(errors);

  if (data.status === "archived") throwValidationError([{ message: "Archiving folders is no longer supported. Delete the folder instead.", code: "INVALID_STATUS" }]);

  const category = await findCategoryById(config, data.categoryId);
  if (!category) throwNotFound("Parent category");

  const parentId = data.parentId || null;
  const siblings = await listAllTopics(config, { categoryIds: [data.categoryId] });
  await assertParentUsable(config, { parentId, categoryId: data.categoryId, all: siblings });
  if (hasSiblingWithTitle({ folders: siblings, categoryId: data.categoryId, parentId, title: data.title })) {
    throwConflict("A folder with this name already exists here.", "DUPLICATE_TITLE");
  }

  const collection = await getTopicsCollection(config);
  const now = new Date();

  const doc = {
    categoryId: new ObjectId(data.categoryId),
    parentId: parentId ? new ObjectId(parentId) : null,
    title: data.title.trim(),
    slug: data.slug,
    status: "active",
    ordering: typeof data.ordering === "number" ? data.ordering : 0,
    intro: typeof data.intro === "string" ? data.intro.trim() : null,
    coverKey: data.coverKey || null,
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

/** @param {{ status?: string, parentId?: string }} filters  parentId: "root" | a folder id (omit = every folder of the category) */
export async function listTopicsByCategory(config, categoryId, filters = {}) {
  if (!ObjectId.isValid(categoryId)) return [];
  const collection = await getTopicsCollection(config);
  const query = { categoryId: new ObjectId(categoryId) };
  if (filters.status) query.status = filters.status;
  if (filters.parentId === "root") query.parentId = null; // matches legacy documents without the field too
  else if (filters.parentId && ObjectId.isValid(filters.parentId)) query.parentId = new ObjectId(filters.parentId);

  return collection.find(query).sort({ ordering: 1, createdAt: 1, _id: 1 }).toArray();
}

export async function updateTopic(config, id, updates) {
  invalidatePublicCache();
  const existing = await findTopicById(config, id);
  if (!existing) throwNotFound("Topic");

  const data = { ...updates };
  if (data.slug !== undefined) data.slug = normalizeSlug(data.slug);

  const errors = validateTopicInput(data, { partial: true });
  if (errors.length > 0) throwValidationError(errors);

  if (data.status === "archived") throwValidationError([{ message: "Archiving folders is no longer supported. Delete the folder instead.", code: "INVALID_STATUS" }]);

  if (data.categoryId !== undefined && String(data.categoryId) !== String(existing.categoryId)) {
    // Articles and subfolders are tied to the category; moving a folder across categories would orphan them.
    throwValidationError([{ message: "A folder cannot be moved to a different category.", code: "INVALID_RELATION" }]);
  }

  const parentChanging = data.parentId !== undefined && String(data.parentId || "") !== String(existing.parentId || "");
  const titleChanging = data.title !== undefined && data.title.trim() !== existing.title;
  if (parentChanging || titleChanging) {
    const all = await listAllTopics(config, { categoryIds: [String(existing.categoryId)] });
    const newParentId = data.parentId !== undefined ? data.parentId || null : existing.parentId ? String(existing.parentId) : null;
    if (parentChanging) await assertParentUsable(config, { folderId: id, parentId: newParentId, categoryId: existing.categoryId, all });
    if (hasSiblingWithTitle({ folders: all, categoryId: existing.categoryId, parentId: newParentId, title: data.title ?? existing.title, exceptId: id })) {
      throwConflict("A folder with this name already exists here.", "DUPLICATE_TITLE");
    }
  }

  const collection = await getTopicsCollection(config);
  const $set = { updatedAt: new Date() };
  for (const key of ["title", "slug", "status", "ordering", "intro", "coverKey"]) {
    if (data[key] !== undefined) $set[key] = typeof data[key] === "string" ? data[key].trim() : data[key];
  }
  if (data.parentId !== undefined) $set.parentId = data.parentId ? new ObjectId(data.parentId) : null;

  // Pins: a date = pinned since then (keeps the pin order stable), null = not pinned. Top-level folders only,
  // and the homepage holds at most HOME_PIN_LIMIT of them.
  for (const key of ["pinHome", "pinAll", "pinSection"]) {
    if (data[key] === undefined) continue;
    if (!data[key]) { $set[key] = null; continue; }
    if (existing[key]) continue; // already pinned: keep its original pin time
    if (existing.parentId) throwValidationError([{ message: "Only a top-level folder can be pinned.", code: "PIN_NOT_ROOT" }]);
    if (key === "pinHome") {
      const others = await collection.countDocuments({ pinHome: { $type: "date" }, status: { $ne: "archived" }, _id: { $ne: new ObjectId(id) } });
      if (others >= HOME_PIN_LIMIT) throwConflict(`Homepage par maximum ${HOME_PIN_LIMIT} folders pin ho sakte hain. Pehle kisi aur folder ko unpin karein.`, "PIN_LIMIT");
    }
    $set[key] = new Date();
  }

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

/**
 * What deleting a folder will do, for the admin's confirmation dialog.
 * Rule: the folder's subfolders and articles move up to its parent folder, or to the category's top level
 * (root folders / general articles) when it has no parent. Nothing but the folder record is removed.
 */
export async function describeTopicDeletion(config, id) {
  const existing = await findTopicById(config, id);
  if (!existing) throwNotFound("Topic");

  const db = await getDb(config);
  const all = await listAllTopics(config, { categoryIds: [String(existing.categoryId)] });
  const { children } = indexFolders(all);
  const plan = deletionPlan(existing, all);
  const parent = plan.newParentId ? all.find((t) => String(t._id) === plan.newParentId) : null;
  const articles = await db.collection("articles").countDocuments({ topicId: new ObjectId(id) });

  return {
    folder: { id: String(existing._id), title: existing.title },
    childFolders: plan.childIds.length,
    nestedFolders: descendantIds(id, children).length,
    articles,
    movesTo: parent ? { id: String(parent._id), title: parent.title } : null, // null = category top level
  };
}

/**
 * Deletes a folder WITHOUT deleting its content: direct subfolders and articles are re-parented first, and
 * only then is the folder record removed. If anything fails part-way, content is still attached to a
 * folder that exists - nothing can be orphaned.
 */
export async function deleteTopic(config, id) {
  invalidatePublicCache();
  const existing = await findTopicById(config, id);
  if (!existing) throwNotFound("Topic");

  const db = await getDb(config);
  const collection = db.collection(COLLECTION);
  const oid = new ObjectId(id);
  const newParent = existing.parentId || null;

  // Moved subfolders are appended after the new parent's current children so ordering stays stable.
  const siblings = await collection.find({ categoryId: existing.categoryId, parentId: newParent }).project({ ordering: 1 }).toArray();
  let next = siblings.reduce((m, t) => Math.max(m, typeof t.ordering === "number" ? t.ordering : 0), -1) + 1;
  const children = await collection.find({ parentId: oid }).sort({ ordering: 1, createdAt: 1, _id: 1 }).project({ _id: 1 }).toArray();
  const now = new Date();
  let movedFolders = 0;
  if (children.length) {
    const res = await collection.bulkWrite(
      children.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { parentId: newParent, ordering: next++, updatedAt: now } } } })),
      { ordered: true }
    );
    movedFolders = res.modifiedCount;
  }

  const moved = await db.collection("articles").updateMany({ topicId: oid }, { $set: { topicId: newParent } });
  await collection.deleteOne({ _id: oid });

  return { deleted: true, movedFolders, movedArticles: moved.modifiedCount, movedTo: newParent ? String(newParent) : null };
}

/**
 * Bulk ordering update scoped to one category — any item whose id isn't
 * actually a topic of that category is silently skipped (filter won't
 * match), preventing a reorder call from one category corrupting
 * ordering in another.
 */
export async function reorderTopics(config, categoryId, items) {
  invalidatePublicCache();
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
    parentId: topic.parentId ? String(topic.parentId) : null,
    title: topic.title,
    slug: topic.slug,
    status: topic.status,
    ordering: topic.ordering,
    intro: topic.intro || null,
    coverKey: topic.coverKey || null,
    // Admin pins: shown first on the homepage (max 3), on "View all folders", and on the Aqaid / Masail pages.
    pinHome: !!topic.pinHome,
    pinAll: !!topic.pinAll,
    pinSection: !!topic.pinSection,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
  };
}
