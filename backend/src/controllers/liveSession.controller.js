import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson, isValidObjectIdString } from "../utils/validate.js";
import { validateLiveSessionInput } from "../utils/validate.courses.js";
import {
  createLiveSession,
  findLiveSessionById,
  listLiveSessions,
  updateLiveSession,
  deleteLiveSession,
  sortForDisplay,
  toSafeLiveSession,
  toPublicLiveSession,
} from "../services/db/liveSession.service.js";
import { syncLiveSessions, isYouTubeConfigured } from "../services/youtube/youtube.service.js";

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function throwValidation(errors) {
  throw fail(errors[0].message, 400, errors[0].code || "INVALID_INPUT");
}

/* ----------------------------- public ----------------------------- */

/**
 * GET /api/public/live-sessions?limit=
 * Published sessions only, ordered live → upcoming → recordings.
 */
export async function publicList(request, env) {
  const config = loadConfig(env);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 12, 1), 48);

  const all = await listLiveSessions(config, { isPublished: true, limit: 200 });
  const sessions = sortForDisplay(all).slice(0, limit);
  return jsonSuccess({ sessions: sessions.map(toPublicLiveSession) }, { allowedOrigin: config.allowedOrigin });
}

/** GET /api/public/live-sessions/:id — an unpublished session responds exactly like a missing one. */
export async function publicGet(request, env, ctx, params) {
  const config = loadConfig(env);
  const session = isValidObjectIdString(params.id) ? await findLiveSessionById(config, params.id) : null;
  if (!session || !session.isPublished) throw fail("Not found.", 404, "NOT_FOUND");
  return jsonSuccess({ session: toPublicLiveSession(session) }, { allowedOrigin: config.allowedOrigin });
}

/* ------------------------------ admin ------------------------------ */

export async function adminList(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const sessions = await listLiveSessions(config, { status: url.searchParams.get("status") || undefined, limit: 200 });
  return jsonSuccess(
    { sessions: sessions.map(toSafeLiveSession), youtubeSync: { configured: isYouTubeConfigured(config) } },
    { allowedOrigin: config.allowedOrigin }
  );
}

export async function adminGet(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const session = isValidObjectIdString(params.id) ? await findLiveSessionById(config, params.id) : null;
  if (!session) throw fail("Live session not found.", 404, "NOT_FOUND");
  return jsonSuccess({ session: toSafeLiveSession(session) }, { allowedOrigin: config.allowedOrigin });
}

export async function adminCreate(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const body = await safeParseJson(request);
  if (!body) throw fail("Request body must be valid JSON.", 400, "INVALID_INPUT");

  const errors = validateLiveSessionInput(body);
  if (errors.length > 0) throwValidation(errors);

  const session = await createLiveSession(config, body);
  return jsonSuccess({ session: toSafeLiveSession(session) }, { status: 201, allowedOrigin: config.allowedOrigin });
}

export async function adminUpdate(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const body = await safeParseJson(request);
  if (!body) throw fail("Request body must be valid JSON.", 400, "INVALID_INPUT");
  if (!isValidObjectIdString(params.id)) throw fail("Live session not found.", 404, "NOT_FOUND");

  const errors = validateLiveSessionInput(body, { partial: true });
  if (errors.length > 0) throwValidation(errors);

  const session = await updateLiveSession(config, params.id, body);
  return jsonSuccess({ session: toSafeLiveSession(session) }, { allowedOrigin: config.allowedOrigin });
}

export async function adminRemove(request, env, ctx, params) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  if (!isValidObjectIdString(params.id)) throw fail("Live session not found.", 404, "NOT_FOUND");
  const result = await deleteLiveSession(config, params.id);
  return jsonSuccess(result, { allowedOrigin: config.allowedOrigin });
}

/** POST /api/admin/live-sessions/sync — manual "sync now" (refresh + discover). */
export async function adminSync(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const summary = await syncLiveSessions(config, { discover: true });
  return jsonSuccess({ sync: summary }, { allowedOrigin: config.allowedOrigin });
}
