import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson } from "../utils/validate.js";
import { validateReleaseInput } from "../utils/appRelease.js";
import { getAndroidRelease, saveAndroidRelease, toAdminRelease, toPublicRelease } from "../services/db/appRelease.service.js";

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * GET /api/public/app-update
 * The newest PUBLISHED Android release, or { release: null } when none is published. The app compares versions itself
 * (it alone knows the installed version). Never cached: a newly published update must be visible at once.
 */
export async function publicGet(request, env) {
  const config = loadConfig(env);
  const doc = await getAndroidRelease(config);
  return jsonSuccess({ platform: "android", release: toPublicRelease(doc) }, {
    allowedOrigin: config.allowedOrigin,
    headers: { "Cache-Control": "no-cache" },
  });
}

/* ------------------------------ admin ------------------------------ */
/* Every /api/admin/* route is already authenticated by the router guard in index.js; requireAdmin is repeated here (one
   verification per request, cached) so these controllers stay safe even if they are ever mounted elsewhere. */

export async function adminGet(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);
  const doc = await getAndroidRelease(config);
  return jsonSuccess({ release: toAdminRelease(doc), allowedHosts: config.appUpdate.allowedHosts }, { allowedOrigin: config.allowedOrigin });
}

/** PUT /api/admin/app-release - full replace of the Android release settings (also used to publish / unpublish). */
export async function adminSave(request, env) {
  const config = loadConfig(env);
  const session = await requireAdmin(request, env);
  const body = await safeParseJson(request);
  if (!body) throw fail("Request body must be valid JSON.", 400, "INVALID_INPUT");

  const { errors, value } = validateReleaseInput(body, { allowedHosts: config.appUpdate.allowedHosts });
  if (errors.length > 0) throw fail(errors[0].message, 400, errors[0].code);

  const doc = await saveAndroidRelease(config, value, session.username);
  return jsonSuccess({ release: toAdminRelease(doc) }, { allowedOrigin: config.allowedOrigin });
}
