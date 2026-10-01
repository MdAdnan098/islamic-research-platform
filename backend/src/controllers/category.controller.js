import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson, validateReorderInput } from "../utils/validate.js";
import {
  createCategory,
  listCategories,
  findCategoryById,
  updateCategory,
  archiveCategory,
  reorderCategories,
  toSafeCategory,
} from "../services/db/category.service.js";

function throwInvalidInput(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = "INVALID_INPUT";
  throw err;
}

function throwNotFound() {
  const err = new Error("Category not found.");
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

export async function create(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body) throwInvalidInput("Request body must be valid JSON.");

  const category = await createCategory(config, body);
  return jsonSuccess({ category: toSafeCategory(category) }, { status: 201, allowedOrigin: config.allowedOrigin });
}

export async function list(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const url = new URL(request.url);
  const filters = {
    status: url.searchParams.get("status") || undefined,
    type: url.searchParams.get("type") || undefined,
  };

  const categories = await listCategories(config, filters);
  return jsonSuccess({ categories: categories.map(toSafeCategory) }, { allowedOrigin: config.allowedOrigin });
}

export async function getOne(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const category = await findCategoryById(config, params.id);
  if (!category) throwNotFound();

  return jsonSuccess({ category: toSafeCategory(category) }, { allowedOrigin: config.allowedOrigin });
}

export async function update(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body) throwInvalidInput("Request body must be valid JSON.");

  const category = await updateCategory(config, params.id, body);
  return jsonSuccess({ category: toSafeCategory(category) }, { allowedOrigin: config.allowedOrigin });
}

export async function archive(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const category = await archiveCategory(config, params.id);
  return jsonSuccess({ category: toSafeCategory(category) }, { allowedOrigin: config.allowedOrigin });
}

export async function reorder(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  const errors = validateReorderInput(body);
  if (errors.length > 0) {
    const err = new Error(errors[0].message);
    err.status = 400;
    err.code = errors[0].code;
    throw err;
  }

  const result = await reorderCategories(config, body.items);
  return jsonSuccess({ reordered: result }, { allowedOrigin: config.allowedOrigin });
}
