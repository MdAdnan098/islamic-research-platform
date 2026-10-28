import { loadConfig } from "../config/env.js";
import { collectMediaKeys, removeUnusedMedia } from "../services/mediaCleanup.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson } from "../utils/validate.js";
import {
  createArticle,
  listArticles,
  findArticleById,
  updateArticle,
  archiveArticle,
  deleteArticle,
  deleteAllArticles,
  updateBlockHighlights,
  toAdminArticle,
  saveArticleDraft,
  discardArticleDraft,
} from "../services/db/article.service.js";
import { findReferencesByIds, toSafeReference } from "../services/db/reference.service.js";

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

  return jsonSuccess({ article: toAdminArticle(article) }, { status: 201, allowedOrigin: config.allowedOrigin });
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
  return jsonSuccess({ articles: articles.map(toAdminArticle), page, limit }, { allowedOrigin: config.allowedOrigin });
}

export async function getOne(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const article = await findArticleById(config, params.id);
  if (!article) throwNotFound();

  return jsonSuccess({ article: toAdminArticle(article) }, { allowedOrigin: config.allowedOrigin });
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
  return jsonSuccess({ article: toAdminArticle(article) }, { allowedOrigin: config.allowedOrigin });
}

export async function archive(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const article = await archiveArticle(config, params.id);
  return jsonSuccess({ article: toAdminArticle(article) }, { allowedOrigin: config.allowedOrigin });
}

/** Only non-empty, structurally valid content may be published. */
export async function publish(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const existing = await findArticleById(config, params.id);
  if (!existing) throwNotFound();

  // Publishing also makes the unpublished copy (edits made from "View site") the live post.
  const pending = existing.pending;
  const blocks = pending ? pending.blocks : existing.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throwInvalidInput("Cannot publish an article with no content blocks.");
  }

  const article = pending
    ? await updateArticle(config, params.id, { blocks, references: (pending.references || []).map(String), status: "published" })
    : await updateArticle(config, params.id, { status: "published" });
  return jsonSuccess({ article: toAdminArticle(article) }, { allowedOrigin: config.allowedOrigin });
}

/** Reverts a published article to draft. publishedAt is kept as a historical record. */
export async function unpublish(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const article = await updateArticle(config, params.id, { status: "draft" });
  return jsonSuccess({ article: toAdminArticle(article) }, { allowedOrigin: config.allowedOrigin });
}

/** DELETE /api/admin/articles/:id — permanent. */
export async function remove(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const gone = await deleteArticle(config, params.id);
  // The post is gone from MongoDB; now its cover / banner / in-post images leave the R2 bucket too (unless another post still uses them).
  await removeUnusedMedia(config, collectMediaKeys(gone));
  return jsonSuccess({ deleted: true }, { allowedOrigin: config.allowedOrigin });
}

/** DELETE /api/admin/articles — permanently removes every article. */
export async function removeAll(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const { count, articles } = await deleteAllArticles(config);
  await removeUnusedMedia(config, collectMediaKeys(articles));
  return jsonSuccess({ deleted: count }, { allowedOrigin: config.allowedOrigin });
}

/**
 * PATCH /api/admin/articles/:id/highlights
 * Body: { baseUpdatedAt, edits: [{ blockId, lang, ranges: [[start, end], ...] }] }
 * Used by the public-site "View site" editing mode. Changes ONLY the highlight marks of the named blocks;
 * 409 if the article changed since `baseUpdatedAt`.
 */
export async function highlights(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body || typeof body !== "object") throwInvalidInput("Request body must be valid JSON.");

  const article = await updateBlockHighlights(config, params.id, { baseUpdatedAt: body.baseUpdatedAt, edits: body.edits });
  return jsonSuccess({ article: toAdminArticle(article) }, { allowedOrigin: config.allowedOrigin });
}

/** The references used by the blocks the admin screens show (the unpublished copy when there is one), in ONE query. */
async function workingReferences(config, article) {
  const ids = (article.pending ? article.pending.references : article.references) || [];
  const list = await findReferencesByIds(config, ids.map(String));
  return list.map(toSafeReference);
}

/**
 * PUT /api/admin/articles/:id/draft
 * Body: { blocks, references, baseRev }. Auto-save for "View site" editing - see saveArticleDraft.
 */
export async function saveDraft(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body || typeof body !== "object") throwInvalidInput("Request body must be valid JSON.");
  if (!Array.isArray(body.blocks)) throwInvalidInput("blocks must be an array.", "INVALID_BLOCK");

  await assertReferencesExist(config, body.references);

  const article = await saveArticleDraft(config, params.id, { blocks: body.blocks, references: body.references, baseRev: body.baseRev });
  return jsonSuccess({ article: toAdminArticle(article), references: await workingReferences(config, article) }, { allowedOrigin: config.allowedOrigin });
}

/** DELETE /api/admin/articles/:id/draft - drops the unpublished copy. */
export async function discardDraft(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const article = await discardArticleDraft(config, params.id);
  return jsonSuccess({ article: toAdminArticle(article), references: await workingReferences(config, article) }, { allowedOrigin: config.allowedOrigin });
}
