import { loadConfig } from "../config/env.js";
import { jsonSuccess } from "../utils/response.js";
import {
  listCategories,
  findCategoryById,
  toSafeCategory,
} from "../services/db/category.service.js";
import { listTopicsByCategory, toSafeTopic } from "../services/db/topic.service.js";
import { listArticles, findArticleBySlug, toSafeArticle } from "../services/db/article.service.js";
import { findReferencesByIds, toSafeReference } from "../services/db/reference.service.js";

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

  const [categories, recentArticles] = await Promise.all([
    listCategories(config, { status: "active" }),
    listArticles(config, { status: "published", limit: 5 }),
  ]);

  return jsonSuccess(
    {
      categories: categories.map(toSafeCategory),
      recentArticles: recentArticles.map(toPublicArticle),
    },
    { allowedOrigin: config.allowedOrigin }
  );
}

/** GET /api/public/categories */
export async function categories(request, env) {
  const config = loadConfig(env);
  const list = await listCategories(config, { status: "active" });
  return jsonSuccess({ categories: list.map(toSafeCategory) }, { allowedOrigin: config.allowedOrigin });
}

/**
 * GET /api/public/topics?categoryId=...
 * Only returns topics when the parent category itself is public/active —
 * if the category is missing or archived, returns an empty list rather
 * than an error, so a probing request can't distinguish "doesn't exist"
 * from "exists but not public".
 */
export async function topics(request, env) {
  const config = loadConfig(env);
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId");

  if (!categoryId) {
    return jsonSuccess({ topics: [] }, { allowedOrigin: config.allowedOrigin });
  }

  const category = await findCategoryById(config, categoryId);
  if (!category || category.status !== "active") {
    return jsonSuccess({ topics: [] }, { allowedOrigin: config.allowedOrigin });
  }

  const list = await listTopicsByCategory(config, categoryId, { status: "active" });
  return jsonSuccess({ topics: list.map(toSafeTopic) }, { allowedOrigin: config.allowedOrigin });
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

  return jsonSuccess(
    {
      article: toPublicArticle(article),
      references: references.map(toSafeReference),
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
