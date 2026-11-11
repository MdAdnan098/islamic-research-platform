import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { loadPublicContext } from "../services/db/publicContent.service.js";
import { rootFolders } from "./public.controller.js";
import { invalidatePublicCache } from "../utils/publicCache.js";
import { homeFolderCompare, permuteAscending, replaceInSlots } from "../utils/reorder.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson, validateReorderInput, isValidObjectIdString } from "../utils/validate.js";
import {
  createTopic,
  listTopicsByCategory,
  findTopicById,
  updateTopic,
  deleteTopic,
  describeTopicDeletion,
  reorderTopics,
  applyFolderOrder,
  toSafeTopic,
} from "../services/db/topic.service.js";

function throwInvalidInput(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = "INVALID_INPUT";
  throw err;
}

function throwNotFound() {
  const err = new Error("Topic not found.");
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

export async function create(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body) throwInvalidInput("Request body must be valid JSON.");

  const topic = await createTopic(config, body);
  return jsonSuccess({ topic: toSafeTopic(topic) }, { status: 201, allowedOrigin: config.allowedOrigin });
}

/** Requires ?categoryId=... — a topic listing only ever makes sense within a category. Optional ?parentId=root|<id>. */
export async function list(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId");
  if (!isValidObjectIdString(categoryId)) {
    throwInvalidInput("categoryId query parameter is required and must be a valid id.");
  }

  const status = url.searchParams.get("status") || undefined;
  const parentId = url.searchParams.get("parentId") || undefined;
  if (parentId && parentId !== "root" && !isValidObjectIdString(parentId)) throwInvalidInput("parentId must be \"root\" or a valid id.");
  const topics = await listTopicsByCategory(config, categoryId, { status, parentId });
  return jsonSuccess({ topics: topics.map(toSafeTopic) }, { allowedOrigin: config.allowedOrigin });
}

export async function getOne(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const topic = await findTopicById(config, params.id);
  if (!topic) throwNotFound();

  return jsonSuccess({ topic: toSafeTopic(topic) }, { allowedOrigin: config.allowedOrigin });
}

export async function update(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body) throwInvalidInput("Request body must be valid JSON.");

  const topic = await updateTopic(config, params.id, body);
  return jsonSuccess({ topic: toSafeTopic(topic) }, { allowedOrigin: config.allowedOrigin });
}

/** GET /api/admin/topics/:id/impact — what a delete would do (shown in the confirmation dialog). */
export async function impact(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const result = await describeTopicDeletion(config, params.id);
  return jsonSuccess({ impact: result }, { allowedOrigin: config.allowedOrigin });
}

/**
 * DELETE /api/admin/topics/:id
 * Removes only the folder record. Its subfolders and articles are moved up to its parent folder
 * (or the category's top level) first - see deleteTopic().
 */
export async function remove(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const result = await deleteTopic(config, params.id);
  return jsonSuccess(result, { allowedOrigin: config.allowedOrigin });
}

/** Body: { categoryId, items: [{ id, ordering }] } — scoped to one category. */
export async function reorder(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!isValidObjectIdString(body?.categoryId)) {
    throwInvalidInput("categoryId is required and must be a valid id.");
  }

  const errors = validateReorderInput(body);
  if (errors.length > 0) {
    const err = new Error(errors[0].message);
    err.status = 400;
    err.code = errors[0].code;
    throw err;
  }

  const result = await reorderTopics(config, body.categoryId, body.items);
  return jsonSuccess({ reordered: result }, { allowedOrigin: config.allowedOrigin });
}

/**
 * POST /api/admin/topics/reorder-list  { scope, ids, parentId? }  - the admin dragged folders on the public site.
 *   scope "roots"    : top-level folders (the /folders page and the Aqaid / Masail pages) -> `ordering`
 *   scope "home"     : the homepage Folders card (not pinned ones)                         -> `homeRank`
 *   scope "children" : subfolders of `parentId`                                            -> `ordering`
 *   scope "pinHome" / "pinAll" : the pinned folders of that list swap their pin times
 * `ids` = the folders as now shown, top to bottom. Folders that were not on screen keep their relative places.
 */
export async function reorderList(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const body = await safeParseJson(request);
  const ids = Array.isArray(body?.ids) ? body.ids.map(String) : null;
  if (!ids || ids.length < 2 || ids.length > 300 || !ids.every(isValidObjectIdString)) throwInvalidInput("ids must be 2-300 valid folder ids.");

  invalidatePublicCache(); // read the freshest folder tree, not a 30-second-old copy
  const ctx = await loadPublicContext(config);
  const bad = () => throwInvalidInput("Ye folders ab is list mein nahi hain. Page refresh karke dobara koshish karein.");

  if (body.scope === "pinHome" || body.scope === "pinAll") {
    const key = body.scope;
    const dates = new Map(ctx.topics.filter((t) => t[key]).map((t) => [String(t._id), new Date(t[key]).getTime()]));
    if (!ids.every((id) => dates.has(id))) bad();
    const next = permuteAscending(dates, ids);
    const result = await applyFolderOrder(config, [...next].filter(([id, v]) => dates.get(id) !== v).map(([id, v]) => ({ id, set: { [key]: new Date(v) } })));
    return jsonSuccess(result, { allowedOrigin: config.allowedOrigin });
  }

  let full; // every folder of the list, current order
  let field = "ordering";
  if (body.scope === "roots") {
    full = rootFolders(ctx, null).map((f) => f.id);
  } else if (body.scope === "home") {
    field = "homeRank";
    full = rootFolders(ctx, "pinHome").filter((f) => !f.pinHome).sort(homeFolderCompare).map((f) => f.id);
  } else if (body.scope === "children") {
    if (!isValidObjectIdString(body.parentId)) throwInvalidInput("parentId is required.");
    full = (ctx.children.get(String(body.parentId)) || []).filter((c) => ctx.visible.has(String(c._id))).map((c) => String(c._id));
  } else {
    throwInvalidInput("Unknown scope.");
  }

  const next = replaceInSlots(full, ids);
  if (!next) bad();
  const current = new Map(ctx.topics.map((t) => [String(t._id), t[field]]));
  // Number every folder of the list by its new place: a small, stable sequence (0, 1, 2 ...).
  const changes = next.map((id, i) => ({ id, set: { [field]: i } })).filter((c) => current.get(c.id) !== c.set[field]);
  const result = await applyFolderOrder(config, changes);
  return jsonSuccess(result, { allowedOrigin: config.allowedOrigin });
}
