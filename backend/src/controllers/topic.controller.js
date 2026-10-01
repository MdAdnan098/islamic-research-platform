import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson, validateReorderInput, isValidObjectIdString } from "../utils/validate.js";
import {
  createTopic,
  listTopicsByCategory,
  findTopicById,
  updateTopic,
  archiveTopic,
  reorderTopics,
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

/** Requires ?categoryId=... — a topic listing only ever makes sense within a category. */
export async function list(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId");
  if (!isValidObjectIdString(categoryId)) {
    throwInvalidInput("categoryId query parameter is required and must be a valid id.");
  }

  const status = url.searchParams.get("status") || undefined;
  const topics = await listTopicsByCategory(config, categoryId, { status });
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

export async function archive(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const topic = await archiveTopic(config, params.id);
  return jsonSuccess({ topic: toSafeTopic(topic) }, { allowedOrigin: config.allowedOrigin });
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
