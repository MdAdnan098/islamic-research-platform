import { loadConfig } from "../config/env.js";
import { requireAdmin, requireRole } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { safeParseJson } from "../utils/validate.js";
import { validateAutoSettings, validateNotificationInput, validateRegistration, validateTokenOnly } from "../utils/push.js";
import {
  countDevices,
  ensurePushIndexes,
  findNotification,
  getAutoSettings,
  listNotifications,
  registerDevice,
  removeDeviceByToken,
  saveAutoSettings,
  toAdminNotification,
  updateDevicePrefs,
} from "../services/db/push.service.js";
import { dispatchNotification, isPushConfigured, runChunk } from "../services/push/dispatcher.js";

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}
const invalid = (errors) => fail(errors[0].message, 400, errors[0].code || "INVALID_INPUT");

/* One warm Worker isolate remembers the indexes were created, so the (idempotent) call is made once, not on every request. */
let indexesReady = false;
async function ready(config) {
  if (indexesReady) return;
  try { await ensurePushIndexes(config); indexesReady = true; } catch (err) { console.error("Push index setup failed:", err?.code || err?.message); }
}
export function _resetPushControllerForTests() { indexesReady = false; limits.clear(); }

/* ----- small per-IP limiter for the public device endpoints (best effort: it lives in one isolate's memory) ----- */
const limits = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 60;
function limited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const entry = limits.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    if (limits.size > 5000) limits.clear();
    limits.set(ip, { start: now, count: 1 });
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_PER_WINDOW) {
    const err = fail("Too many requests. Please try again later.", 429, "RATE_LIMITED");
    err.retryAfter = Math.ceil((WINDOW_MS - (now - entry.start)) / 1000);
    throw err;
  }
}

const noStore = { "Cache-Control": "no-store" };

/* ------------------------------- public ------------------------------- */

/** GET /api/public/push/status - lets the website / app hide the notification UI when the server cannot send yet. */
export async function publicStatus(request, env) {
  const config = loadConfig(env);
  return jsonSuccess({ enabled: isPushConfigured(config) }, { allowedOrigin: config.allowedOrigin, headers: noStore });
}

/** POST /api/public/push/register  { platform, token, installId?, prefs? } - every app start / page load; also token refresh. */
export async function publicRegister(request, env) {
  const config = loadConfig(env);
  limited(request);
  const body = await safeParseJson(request);
  const { errors, value } = validateRegistration(body);
  if (errors.length) throw invalid(errors);
  await ready(config);
  const out = await registerDevice(config, value);
  // The token is never echoed back; the device only learns which preferences the server now holds for it.
  return jsonSuccess({ registered: true, prefs: out.prefs }, { allowedOrigin: config.allowedOrigin, headers: noStore });
}

/** PUT /api/public/push/preferences  { token, prefs } - the token is the proof that this device owns the record. */
export async function publicPreferences(request, env) {
  const config = loadConfig(env);
  limited(request);
  const body = await safeParseJson(request);
  const { errors } = validateTokenOnly(body);
  if (errors.length) throw invalid(errors);
  if (!body.prefs || typeof body.prefs !== "object" || Array.isArray(body.prefs)) throw fail("prefs must be an object.", 400, "INVALID_INPUT");
  const prefs = await updateDevicePrefs(config, body.token, body.prefs);
  if (!prefs) throw fail("This device is not registered.", 404, "NOT_REGISTERED");
  return jsonSuccess({ prefs }, { allowedOrigin: config.allowedOrigin, headers: noStore });
}

/** POST /api/public/push/unregister  { token } - the device turned notifications off, or the user logged out of the feature. */
export async function publicUnregister(request, env) {
  const config = loadConfig(env);
  limited(request);
  const body = await safeParseJson(request);
  const { errors } = validateTokenOnly(body);
  if (errors.length) throw invalid(errors);
  // Always the same answer, whether or not the token was known: nothing is revealed about other devices.
  await removeDeviceByToken(config, body.token);
  return jsonSuccess({ removed: true }, { allowedOrigin: config.allowedOrigin, headers: noStore });
}

/* -------------------------------- admin -------------------------------- */
/* Every /api/admin/* path is already authenticated by the router guard in index.js; the role is checked again here. */

async function adminSession(request, env) {
  const session = await requireAdmin(request, env);
  requireRole(session, ["admin"]);
  return session;
}

/** GET /api/admin/notifications - history, device counts and settings. Never contains a token or a credential. */
export async function adminOverview(request, env) {
  const config = loadConfig(env);
  await adminSession(request, env);
  await ready(config);
  const [notifications, devices, auto] = await Promise.all([listNotifications(config, 50), countDevices(config), getAutoSettings(config)]);
  return jsonSuccess(
    {
      configured: isPushConfigured(config),
      devices,
      auto,
      batchSize: config.push.batchSize,
      notifications: notifications.map(toAdminNotification),
    },
    { allowedOrigin: config.allowedOrigin }
  );
}

/** POST /api/admin/notifications - an admin-written notification, sent now. */
export async function adminSend(request, env) {
  const config = loadConfig(env);
  const session = await adminSession(request, env);
  const body = await safeParseJson(request);
  const { errors, value } = validateNotificationInput(body, { siteOrigin: config.push.siteOrigin });
  if (errors.length) throw invalid(errors);
  await ready(config);

  const out = await dispatchNotification(config, {
    ...value,
    source: "custom",
    kind: "custom",
    // The dashboard sends one id per form; a double click or a retried request carries the same id and is ignored.
    dedupeKey: value.clientRequestId ? `custom:${value.clientRequestId}` : null,
    createdBy: session.username,
  });
  if (out.duplicate) throw fail("This notification was already sent.", 409, "DUPLICATE_NOTIFICATION");
  return jsonSuccess({ notification: out.notification }, { status: 201, allowedOrigin: config.allowedOrigin });
}

/** POST /api/admin/notifications/:id/continue - sends the next chunk of a notification that still has devices left. */
export async function adminContinue(request, env, ctx, params) {
  const config = loadConfig(env);
  await adminSession(request, env);
  if (!isPushConfigured(config)) throw fail("Push notifications are not configured on the server.", 503, "PUSH_NOT_CONFIGURED");
  const existing = await findNotification(config, params.id);
  if (!existing) throw fail("Notification not found.", 404, "NOT_FOUND");
  const after = await runChunk(config, existing._id);
  return jsonSuccess({ notification: toAdminNotification(after) }, { allowedOrigin: config.allowedOrigin });
}

/** PUT /api/admin/notifications/auto-settings - switch the automatic events on / off. */
export async function adminSaveAuto(request, env) {
  const config = loadConfig(env);
  await adminSession(request, env);
  const body = await safeParseJson(request);
  const { errors, value } = validateAutoSettings(body);
  if (errors.length) throw invalid(errors);
  const auto = await saveAutoSettings(config, value);
  return jsonSuccess({ auto }, { allowedOrigin: config.allowedOrigin });
}
