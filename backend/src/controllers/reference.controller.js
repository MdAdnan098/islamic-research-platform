import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson } from "../utils/validate.js";
import {
  createReference,
  listReferences,
  findReferenceById,
  updateReference,
  deleteReference,
  toSafeReference,
} from "../services/db/reference.service.js";

function throwInvalidInput(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = "INVALID_INPUT";
  throw err;
}

function throwNotFound() {
  const err = new Error("Reference not found.");
  err.status = 404;
  err.code = "NOT_FOUND";
  throw err;
}

export async function create(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body) throwInvalidInput("Request body must be valid JSON.");

  const reference = await createReference(config, body);
  return jsonSuccess({ reference: toSafeReference(reference) }, { status: 201, allowedOrigin: config.allowedOrigin });
}

export async function list(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const url = new URL(request.url);
  const filters = {
    book: url.searchParams.get("book") || undefined,
    author: url.searchParams.get("author") || undefined,
    limit: Number(url.searchParams.get("limit")) || undefined,
  };

  const references = await listReferences(config, filters);
  return jsonSuccess({ references: references.map(toSafeReference) }, { allowedOrigin: config.allowedOrigin });
}

export async function getOne(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const reference = await findReferenceById(config, params.id);
  if (!reference) throwNotFound();

  return jsonSuccess({ reference: toSafeReference(reference) }, { allowedOrigin: config.allowedOrigin });
}

export async function update(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const body = await safeParseJson(request);
  if (!body) throwInvalidInput("Request body must be valid JSON.");

  const reference = await updateReference(config, params.id, body);
  return jsonSuccess({ reference: toSafeReference(reference) }, { allowedOrigin: config.allowedOrigin });
}

/** Guarded: deleteReference itself throws 409 REFERENCE_IN_USE if any article cites it. */
export async function remove(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  await deleteReference(config, params.id);
  return jsonSuccess({ deleted: true }, { allowedOrigin: config.allowedOrigin });
}
