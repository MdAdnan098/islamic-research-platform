import { listCategories } from "./category.service.js";
import { listAllTopics } from "./topic.service.js";
import { cached } from "../../utils/publicCache.js";
import { indexFolders, ancestorsOf, descendantIds, visibleFolderIds } from "../../utils/folderTree.js";

/**
 * Shared read-side logic for the public API: which categories/folders are public, and the breadcrumb
 * (section + folder path) of an article. Everything here is derived from live data - no folder names or
 * counts are hard-coded.
 */

/** Public label of a section type, used only to let a search for "aqaid" / "masail" match that section. */
export const SECTION_SEARCH_LABEL = { aqeedah: "aqaid", masail: "masail" };

/**
 * Loads the public categories and every folder under them, plus which folders are visible
 * (active, with every ancestor active). One small read each; folder counts are modest.
 */
export function loadPublicContext(config, { type } = {}) {
  return cached(`ctx:${config.mongodbDbName}:${type || "all"}`, () => buildPublicContext(config, { type }));
}

async function buildPublicContext(config, { type } = {}) {
  const all = await listCategories(config, { status: "active" });
  const categories = type ? all.filter((c) => c.type === type) : all;
  const categoryIds = categories.map((c) => String(c._id));
  const topics = categoryIds.length ? await listAllTopics(config, { categoryIds }) : [];
  const visible = visibleFolderIds(topics);
  const { byId, children } = indexFolders(topics);
  const categoryById = new Map(categories.map((c) => [String(c._id), c]));
  return { categories, categoryIds, categoryById, topics, visible, byId, children, hiddenIds: topics.filter((t) => !visible.has(String(t._id))).map((t) => String(t._id)) };
}

/** Folder trail of an article: [{ title, slug }] root -> its folder. Empty when it has no folder or the folder is hidden. */
export function folderTrail(ctx, topicId) {
  if (!topicId) return [];
  const id = String(topicId);
  if (!ctx.visible.has(id)) return [];
  const folder = ctx.byId.get(id);
  return [...ancestorsOf(folder, ctx.byId), folder].map((f) => ({ title: f.title, slug: f.slug }));
}

/** Adds the breadcrumb data cards need: `section` (aqeedah | masail), `categoryName`, `folders`. */
export function withTrail(ctx, article) {
  const cat = ctx.categoryById.get(article.categoryId);
  return { ...article, section: cat?.type || null, categoryName: cat?.name || null, folders: folderTrail(ctx, article.topicId) };
}

/** A folder plus all its descendants (ids), only those that are visible. */
export function visibleSubtreeIds(ctx, folderId) {
  return [String(folderId), ...descendantIds(folderId, ctx.children)].filter((id) => ctx.visible.has(id));
}
