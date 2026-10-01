import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson } from "../utils/validate.js";
import {
  createArticle,
  listArticles,
  findArticleById,
  updateArticle,
  archiveArticle,
  toSafeArticle,
} from "../services/db/article.service.js";
import { findReferencesByIds } from "../services/db/reference.service.js";

function throwInvalidInput(message, code = "INVALID_INPUT") {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  throw err;
}

function throwNotFound() {
  const err = new Error("Article not found.");
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

/**
 * Verifies every id in `referenceIds` actually exists in the references
 * collection. Sits here (controller layer), not inside article.service.js,
 * specifically to avoid article.service.js <-> reference.service.js
 * forming a circular import (reference.service.js already imports
 * article.service.js for its own guarded-delete check).
 */
async function assertReferencesExist(config, referenceIds = []) {
  if (!referenceIds || referenceIds.length === 0) return;

  const uniqueIds = [...new Set(referenceIds)];
  const found = await findReferencesByIds(config, uniqueIds);

  if (found.length !== uniqueIds.length) {
    throwInvalidInput("One or more referenced references do not exist.", "INVALID_RELATION");
  }
}

/** Create always starts as a draft — publishing is a separate, explicit action. */
export async function create(request, env) {
  const config = loadConfig(env);
  const session = await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body) throwInvalidInput("Request body must be valid JSON.");

  await assertReferencesExist(config, body.references);

  const article = await createArticle(config, {
    ...body,
    authorId: session.sub,
    status: "draft",
  });

  return jsonSuccess({ article: toSafeArticle(article) }, { status: 201, allowedOrigin: config.allowedOrigin });
}

export async function list(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const url = new URL(request.url);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const limit = Number(url.searchParams.get("limit")) || 20;

  const filters = {
    categoryId: url.searchParams.get("categoryId") || undefined,
    topicId: url.searchParams.get("topicId") || undefined,
    status: url.searchParams.get("status") || undefined,
    language: url.searchParams.get("language") || undefined,
    limit,
    skip: (page - 1) * limit,
  };

  const articles = await listArticles(config, filters);
  return jsonSuccess({ articles: articles.map(toSafeArticle), page, limit }, { allowedOrigin: config.allowedOrigin });
}

export async function getOne(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const article = await findArticleById(config, params.id);
  if (!article) throwNotFound();

  return jsonSuccess({ article: toSafeArticle(article) }, { allowedOrigin: config.allowedOrigin });
}

/**
 * General update never changes `status` — status transitions must go
 * through /publish, /unpublish, or /archive so they stay explicit and
 * auditable (per spec: "draft/archive transitions must be explicit").
 */
export async function update(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body) throwInvalidInput("Request body must be valid JSON.");

  if (body.status !== undefined) {
    throwInvalidInput("Use /publish, /unpublish, or /archive to change article status.");
  }

  await assertReferencesExist(config, body.references);

  const article = await updateArticle(config, params.id, body);
  return jsonSuccess({ article: toSafeArticle(article) }, { allowedOrigin: config.allowedOrigin });
}

export async function archive(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const article = await archiveArticle(config, params.id);
  return jsonSuccess({ article: toSafeArticle(article) }, { allowedOrigin: config.allowedOrigin });
}

/** Only non-empty, structurally valid content may be published. */
export async function publish(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const existing = await findArticleById(config, params.id);
  if (!existing) throwNotFound();

  if (!Array.isArray(existing.blocks) || existing.blocks.length === 0) {
    throwInvalidInput("Cannot publish an article with no content blocks.");
  }

  const article = await updateArticle(config, params.id, { status: "published" });
  return jsonSuccess({ article: toSafeArticle(article) }, { allowedOrigin: config.allowedOrigin });
}

/** Reverts a published article to draft. publishedAt is kept as a historical record. */
export async function unpublish(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const article = await updateArticle(config, params.id, { status: "draft" });
  return jsonSuccess({ article: toSafeArticle(article) }, { allowedOrigin: config.allowedOrigin });
}
