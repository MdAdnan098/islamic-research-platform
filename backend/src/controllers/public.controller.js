import { loadConfig } from "../config/env.js";
import { jsonSuccess } from "../utils/response.js";
import {
  listCategories,
  findCategoryById,
  toSafeCategory,
} from "../services/db/category.service.js";
import { toSafeTopic } from "../services/db/topic.service.js";
import {
  listArticles,
  findArticleBySlug,
  toSafeArticle,
  listPublicArticles,
  countPublishedByTopic,
  searchPublicArticles,
  backfillSearchFields,
} from "../services/db/article.service.js";
import { findReferencesByIds, toSafeReference } from "../services/db/reference.service.js";
import { loadPublicContext, folderTrail, withTrail, visibleSubtreeIds, SECTION_SEARCH_LABEL } from "../services/db/publicContent.service.js";
import { CATEGORY_TYPES } from "../utils/contentEnums.js";
import { normalizeForSearch, parseSearchQuery, phoneticNameMatch, phoneticQueryTokens } from "../utils/searchText.js";
import { enforceRateLimit } from "../middleware/rateLimit.js";
import { isValidObjectIdString } from "../utils/validate.js";

/** The homepage "Latest Posts" card count. Unchanged from the original site (5); the homepage asks for exactly this many. */
const HOME_LATEST_LIMIT = 5;
/** Folders shown on the homepage "Folders" card (newest first; the rest live under View All). */
const HOME_FOLDERS_LIMIT = 10;
/** Short browser cache for list endpoints that change rarely (admin edits show up within ~30 s). */
const LIST_CACHE = { "Cache-Control": "public, max-age=30" };

function intParam(url, name, fallback) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) ? n : fallback;
}

function throwInvalid(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = "INVALID_INPUT";
  throw err;
}

function sectionTypeParam(url) {
  const type = url.searchParams.get("type");
  if (!type) return undefined;
  if (!CATEGORY_TYPES.includes(type)) throwInvalid(`type must be one of: ${CATEGORY_TYPES.join(", ")}.`);
  return type;
}

function throwNotFound() {
  const err = new Error("Not found.");
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

/** Strips the internal admin authorId before anything goes to a public response. */
function toPublicArticle(article) {
  const safe = toSafeArticle(article);
  const { authorId, ...publicSafe } = safe;
  return publicSafe;
}

/**
 * GET /api/public/home
 * Minimal homepage composition: public categories + the most recently
 * published articles. No hard-coded content — an empty database yields
 * empty arrays.
 */
export async function home(request, env) {
  const config = loadConfig(env);

  const ctx = await loadPublicContext(config);
  const { articles } = await listPublicArticles(config, { categoryIds: ctx.categoryIds, limit: HOME_LATEST_LIMIT });

  return jsonSuccess(
    {
      categories: ctx.categories.map(toSafeCategory),
      recentArticles: articles.map((a) => withTrail(ctx, a)),
      folders: await homeFolders(config, ctx),
    },
    { allowedOrigin: config.allowedOrigin, headers: LIST_CACHE }
  );
}

/** GET /api/public/categories */
export async function categories(request, env) {
  const config = loadConfig(env);
  const list = await listCategories(config, { status: "active" });
  return jsonSuccess({ categories: list.map(toSafeCategory) }, { allowedOrigin: config.allowedOrigin });
}

/**
 * GET /api/public/topics?categoryId=...&parentId=root|<folderId>
 * Only returns folders that are publicly visible (active, with every ancestor active) and only when the
 * parent category itself is public - otherwise an empty list, so a probing request can't distinguish
 * "doesn't exist" from "exists but not public". Without parentId every visible folder of the category is
 * returned (each carries its `parentId`); with parentId=root only top-level folders, with an id only that
 * folder's direct subfolders.
 */
export async function topics(request, env) {
  const config = loadConfig(env);
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId");
  const parentId = url.searchParams.get("parentId");
  const empty = () => jsonSuccess({ topics: [] }, { allowedOrigin: config.allowedOrigin });

  if (!categoryId || !isValidObjectIdString(categoryId)) return empty();
  if (parentId && parentId !== "root" && !isValidObjectIdString(parentId)) throwInvalid('parentId must be "root" or a valid id.');

  const category = await findCategoryById(config, categoryId);
  if (!category || category.status !== "active") return empty();

  const ctx = await loadPublicContext(config);
  let list = ctx.topics.filter((t) => String(t.categoryId) === categoryId && ctx.visible.has(String(t._id)));
  if (parentId === "root") list = list.filter((t) => !t.parentId);
  else if (parentId) list = list.filter((t) => String(t.parentId || "") === parentId);

  return jsonSuccess({ topics: list.map(toSafeTopic) }, { allowedOrigin: config.allowedOrigin, headers: LIST_CACHE });
}

/** Root (top-level) visible folders in the public order, with section label data. Used by the homepage and /folders. */
function rootFolders(ctx) {
  const catOrder = (t) => ctx.categoryById.get(String(t.categoryId))?.ordering ?? 0;
  return ctx.topics
    .filter((t) => !t.parentId && ctx.visible.has(String(t._id)))
    .sort((a, b) =>
      (a.ordering ?? 0) - (b.ordering ?? 0) ||
      catOrder(a) - catOrder(b) ||
      new Date(a.createdAt || 0) - new Date(b.createdAt || 0) ||
      String(a._id).localeCompare(String(b._id))
    )
    .map((t) => {
      const cat = ctx.categoryById.get(String(t.categoryId));
      return { ...toSafeTopic(t), section: cat?.type || null, categoryName: cat?.name || null };
    });
}

/** Newest root folders for the homepage card, each with `articleCount` = published articles in it and all its visible subfolders. */
async function homeFolders(config, ctx) {
  const newest = [...rootFolders(ctx)]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || String(b.id).localeCompare(String(a.id)))
    .slice(0, HOME_FOLDERS_LIMIT);
  const direct = await countPublishedByTopic(config, ctx.categoryIds);
  return newest.map((f) => ({
    ...f,
    articleCount: visibleSubtreeIds(ctx, f.id).reduce((sum, id) => sum + (direct.get(id) || 0), 0),
  }));
}

/**
 * GET /api/public/folders?type=&page=&limit=
 * Root (top-level) folders only, across public categories, optionally of one section type. Order: the folder's
 * configured `ordering`, then its category's ordering, then creation time, then id - deterministic, and it
 * interleaves sections so a short list (the homepage shows 4) is not all from one section.
 * Each folder carries `section` (aqeedah | masail) and `categoryName` for the subtle label.
 */
export async function folders(request, env) {
  const config = loadConfig(env);
  const url = new URL(request.url);
  const type = sectionTypeParam(url);
  const limit = Math.min(Math.max(intParam(url, "limit", 12), 1), 100);
  const page = Math.min(Math.max(intParam(url, "page", 1), 1), 10_000);

  const ctx = await loadPublicContext(config, { type });
  const roots = rootFolders(ctx);
  const slice = roots.slice((page - 1) * limit, page * limit);
  return jsonSuccess({ folders: slice, total: roots.length, hasMore: page * limit < roots.length, page, limit }, { allowedOrigin: config.allowedOrigin, headers: LIST_CACHE });
}

/**
 * GET /api/public/folders/by-slug?type=aqeedah|masail&slug=...
 * One visible folder with its breadcrumb (ancestors) and immediate subfolders. Hidden, archived or unknown
 * folders are an identical 404.
 */
export async function folderBySlug(request, env) {
  const config = loadConfig(env);
  const url = new URL(request.url);
  const type = sectionTypeParam(url);
  const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
  if (!type || !slug || slug.length > 200) throwInvalid("type and slug are required.");

  const ctx = await loadPublicContext(config, { type });
  const folder = ctx.topics.find((t) => t.slug === slug && ctx.visible.has(String(t._id)));
  if (!folder) throwNotFound();

  const cat = ctx.categoryById.get(String(folder.categoryId));
  const trail = folderTrail(ctx, String(folder._id)); // root -> this folder
  const children = (ctx.children.get(String(folder._id)) || []).filter((c) => ctx.visible.has(String(c._id)));
  return jsonSuccess(
    {
      folder: toSafeTopic(folder),
      category: toSafeCategory(cat),
      section: cat.type,
      ancestors: trail.slice(0, -1),
      children: children.map(toSafeTopic),
    },
    { allowedOrigin: config.allowedOrigin, headers: LIST_CACHE }
  );
}

/**
 * GET /api/public/articles?categoryId=&topicId=&language=&page=&limit=
 * Always forces status=published regardless of any client input, and
 * hides content under a non-public category.
 */
export async function articles(request, env) {
  const config = loadConfig(env);
  const url = new URL(request.url);

  const categoryId = url.searchParams.get("categoryId") || undefined;
  const topicId = url.searchParams.get("topicId") || undefined;
  const language = url.searchParams.get("language") || undefined;
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const limit = Number(url.searchParams.get("limit")) || 20;

  // Newer listing mode: a section's general articles, or one folder's direct articles. Newest first (publishedAt,
  // then id), blocks left out, `hasMore` for "Load more". Hidden folders/categories yield nothing.
  const type = sectionTypeParam(url);
  const general = url.searchParams.get("general") === "1";
  if (type || general || topicId) {
    if (topicId && !isValidObjectIdString(topicId)) throwInvalid("topicId must be a valid id.");
    const ctx = await loadPublicContext(config, { type });
    if (topicId && !ctx.visible.has(topicId)) {
      return jsonSuccess({ articles: [], hasMore: false, page, limit }, { allowedOrigin: config.allowedOrigin });
    }
    const categoryIds = categoryId ? ctx.categoryIds.filter((id) => id === categoryId) : ctx.categoryIds;
    const result = await listPublicArticles(config, { categoryIds, topicId, general, hiddenTopicIds: ctx.hiddenIds, language, page, limit });
    return jsonSuccess(result, { allowedOrigin: config.allowedOrigin });
  }

  if (categoryId) {
    const category = await findCategoryById(config, categoryId);
    if (!category || category.status !== "active") {
      return jsonSuccess({ articles: [], page, limit }, { allowedOrigin: config.allowedOrigin });
    }
  }

  const list = await listArticles(config, {
    categoryId,
    topicId,
    language,
    status: "published",
    limit,
    skip: (page - 1) * limit,
  });

  return jsonSuccess(
    { articles: list.map(toPublicArticle), page, limit },
    { allowedOrigin: config.allowedOrigin }
  );
}

/**
 * GET /api/public/latest?page=&limit=&language=
 * One combined feed of every published article of every public category, any folder depth, newest first
 * (publishedAt, falling back to createdAt; _id breaks ties so pages are stable). Server-side paginated.
 */
export async function latest(request, env) {
  const config = loadConfig(env);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(intParam(url, "limit", 12), 1), 50);
  const page = Math.min(Math.max(intParam(url, "page", 1), 1), 10_000);
  const language = url.searchParams.get("language") || undefined;

  const ctx = await loadPublicContext(config);
  const result = await listPublicArticles(config, { categoryIds: ctx.categoryIds, language, page, limit });
  return jsonSuccess({ ...result, articles: result.articles.map((a) => withTrail(ctx, a)) }, { allowedOrigin: config.allowedOrigin, headers: LIST_CACHE });
}

/**
 * GET /api/public/search?q=&page=&limit=&language=
 * Public, read-only. Published articles only, in public categories only. Matches title and body text in every
 * script version, excerpt/SEO text, captions, reference book/author, and also folder / category names (a
 * folder-name match returns that folder and the articles inside it). Query is length-limited, normalised and
 * only ever used as escaped literals.
 */
let lastBackfillAt = 0;

export async function search(request, env) {
  const config = loadConfig(env);
  enforceRateLimit(request, "public-search", { max: 90, windowMs: 60_000 });

  const url = new URL(request.url);
  const limit = Math.min(Math.max(intParam(url, "limit", 12), 1), 30);
  const page = Math.min(Math.max(intParam(url, "page", 1), 1), 500);
  const language = url.searchParams.get("language") || undefined;

  const parsed = parseSearchQuery(url.searchParams.get("q") || "");
  if (!parsed.ok) {
    if (parsed.reason === "too_long") throwInvalid("Search text is too long (max 100 characters).");
    return jsonSuccess({ query: "", reason: parsed.reason, articles: [], folders: [], hasMore: false, page, limit }, { allowedOrigin: config.allowedOrigin });
  }

  // Articles saved before search existed get their search copy filled in a few at a time (at most once a minute per isolate).
  if (Date.now() - lastBackfillAt > 60_000) {
    lastBackfillAt = Date.now();
    try { await backfillSearchFields(config, { limit: 25 }); } catch (err) { console.error("Search backfill failed:", err.message); }
  }

  const ctx = await loadPublicContext(config);
  const { tokens, normalized } = parsed;
  const phonetic = phoneticQueryTokens(normalized);
  // A name matches when it contains the query exactly, or merely SOUNDS like it (any word starts like a query word).
  const exactHit = (name) => {
    const n = normalizeForSearch(String(name || ""));
    return !!n && (n.includes(normalized) || tokens.every((t) => n.includes(t)));
  };
  const nameHit = (name) => exactHit(name) || phoneticNameMatch(normalizeForSearch(String(name || "")), phonetic);

  const matchedFolders = ctx.topics.filter((t) => ctx.visible.has(String(t._id)) && nameHit(t.title));
  const folderIds = [...new Set(matchedFolders.flatMap((f) => visibleSubtreeIds(ctx, f._id)))].slice(0, 300);
  const matchedCategoryIds = normalized.length >= 3
    ? ctx.categories.filter((c) => exactHit(c.name) || exactHit(c.slug) || normalizeForSearch(SECTION_SEARCH_LABEL[c.type] || "") === normalized).map((c) => String(c._id))
    : [];

  const result = await searchPublicArticles(config, { tokens, phrase: normalized, phonetic, categoryIds: ctx.categoryIds, folderIds, matchedCategoryIds, language, page, limit });

  // exact folder-name matches first, then the ones that merely sound alike
  const ranked = [...matchedFolders].sort((a, b) => Number(exactHit(b.title)) - Number(exactHit(a.title)));
  const folderCards = page === 1
    ? ranked.slice(0, 6).map((f) => ({ ...toSafeTopic(f), section: ctx.categoryById.get(String(f.categoryId))?.type || null, folders: folderTrail(ctx, String(f._id)).slice(0, -1) }))
    : [];

  return jsonSuccess(
    { query: normalized, articles: result.articles.map((a) => withTrail(ctx, a)), folders: folderCards, hasMore: result.hasMore, page: result.page, limit: result.limit },
    { allowedOrigin: config.allowedOrigin }
  );
}

/**
 * GET /api/public/articles/:slug
 * Only a published article is ever returned — a draft/archived article
 * with a matching slug responds identically to a nonexistent slug (404),
 * so a guess can't be used to confirm unpublished content exists.
 * Resolved references are included inline (the article detail page's
 * main real use case for reference data).
 */
export async function articleBySlug(request, env, ctx, params) {
  const config = loadConfig(env);

  const article = await findArticleBySlug(config, params.slug);
  if (!article || article.status !== "published") throwNotFound();

  const references = await findReferencesByIds(config, (article.references || []).map(String));
  const pub = await loadPublicContext(config);
  const trail = withTrail(pub, { categoryId: String(article.categoryId), topicId: article.topicId ? String(article.topicId) : null });

  return jsonSuccess(
    {
      article: toPublicArticle(article),
      references: references.map(toSafeReference),
      // Breadcrumb data: section type, category name and the visible folder path (root -> article's folder).
      trail: { section: trail.section, categoryName: trail.categoryName, folders: trail.folders },
    },
    { allowedOrigin: config.allowedOrigin }
  );
}

/**
 * GET /api/public/references
 * Returns references actually cited by published articles only — not
 * the whole references collection — so unused/draft-only reference
 * entries aren't exposed. Capped to a reasonable working set; proper
 * aggregation/search is deferred (see project roadmap, Phase 7).
 */
export async function references(request, env) {
  const config = loadConfig(env);

  const publishedArticles = await listArticles(config, { status: "published", limit: 100 });
  const referenceIds = [...new Set(publishedArticles.flatMap((a) => (a.references || []).map(String)))].slice(
    0,
    200
  );

  const list = await findReferencesByIds(config, referenceIds);
  return jsonSuccess({ references: list.map(toSafeReference) }, { allowedOrigin: config.allowedOrigin });
}
