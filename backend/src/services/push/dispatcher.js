import { getAccessToken, parseServiceAccount, sendMessage } from "./fcm.service.js";
import {
  claimNotification,
  countRecipients,
  deleteDevicesByIds,
  findNotification,
  finishChunk,
  leaseNotification,
  listRecipientsAfter,
  listUnfinished,
  toAdminNotification,
} from "../db/push.service.js";
import { buildFcmMessage, clip } from "../../utils/push.js";

/**
 * Sends notifications through FCM, in chunks, and keeps the history record up to date.
 *
 * Why chunks: a Cloudflare Worker may make only a limited number of outgoing requests per invocation (50 on the free plan),
 * and one FCM request is needed per device. Each call handles `config.push.batchSize` devices; the notification keeps a
 * cursor, so the rest is sent by the next chunk (the admin dashboard keeps calling "continue" while it is open, and the
 * optional cron does the same). A lease makes sure two requests never send the same chunk.
 */

const GROUP_SIZE = 8; // simultaneous FCM requests
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function pushAccount(config) {
  return parseServiceAccount(config.push?.serviceAccountJson);
}
export const isPushConfigured = (config) => !!pushAccount(config);

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Creates the history record and sends the first chunk.
 * @param input { title, body, category, link, platforms, source: "auto"|"custom", kind, dedupeKey|null, createdBy }
 * @returns {{ duplicate: boolean, notification: object|null }}
 */
export async function dispatchNotification(config, input, deps = {}) {
  if (!isPushConfigured(config)) throw fail("Push notifications are not configured on the server (FIREBASE_SERVICE_ACCOUNT is missing or invalid).", 503, "PUSH_NOT_CONFIGURED");
  const now = deps.now ? deps.now() : new Date();
  const targeted = await countRecipients(config, input.platforms, input.category);

  const claim = await claimNotification(config, {
    title: clip(input.title, 100),
    body: clip(input.body, 300),
    category: input.category,
    link: input.link || "",
    platforms: input.platforms,
    source: input.source || "custom",
    kind: input.kind || "custom",
    dedupeKey: input.dedupeKey || null,
    status: "queued",
    targeted,
    counts: { android: { sent: 0, failed: 0 }, web: { sent: 0, failed: 0 }, removed: 0 },
    cursor: null,
    leaseUntil: null,
    createdAt: now,
    completedAt: null,
    createdBy: String(input.createdBy || "").slice(0, 80),
  });
  if (!claim.created) return { duplicate: true, notification: null };

  const notification = await runChunk(config, claim.id, deps);
  return { duplicate: false, notification: toAdminNotification(notification) };
}

async function sendWithRetry(account, body, fetchImpl, accessToken) {
  let result = await sendMessage(account, body, { fetchImpl, accessToken });
  if (!result.ok && result.kind === "retry") {
    await sleep(400);
    result = await sendMessage(account, body, { fetchImpl, accessToken });
  }
  return result;
}

/**
 * Handles the next `batchSize` devices of one notification. Safe to call repeatedly and concurrently.
 * @returns the (updated) notification document
 */
export async function runChunk(config, id, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const note = await findNotification(config, id);
  if (!note || !["queued", "sending"].includes(note.status)) return note;

  const account = pushAccount(config);
  if (!account) return note;
  if (!(await leaseNotification(config, note._id, deps.now ? deps.now() : new Date()))) return findNotification(config, id); // someone else is sending it

  const batch = config.push.batchSize;
  const devices = await listRecipientsAfter(config, note.platforms, note.category, note.cursor, batch);

  // ONE Google OAuth exchange per chunk (not one per device): it also saves outgoing requests on the free plan.
  let accessToken = deps.accessToken;
  if (devices.length && !accessToken) {
    try {
      accessToken = await getAccessToken(account, { fetchImpl });
    } catch (e) {
      await finishChunk(config, note._id, { cursor: note.cursor || null, inc: {}, status: "failed", completedAt: new Date(), lastError: e.code || "FCM_AUTH_FAILED" });
      return findNotification(config, id);
    }
  }

  const inc = { "counts.android.sent": 0, "counts.android.failed": 0, "counts.web.sent": 0, "counts.web.failed": 0, "counts.removed": 0 };
  const dead = [];
  let lastError;
  let aborted = false;
  let cursor = note.cursor || null;

  for (let i = 0; i < devices.length && !aborted; i += GROUP_SIZE) {
    const group = devices.slice(i, i + GROUP_SIZE);
    const results = await Promise.all(
      group.map(async (device) => {
        const body = buildFcmMessage({
          platform: device.platform,
          token: device.token,
          notification: { id: note._id, title: note.title, body: note.body, link: note.link, category: note.category, kind: note.kind },
          siteOrigin: config.push.siteOrigin,
          iconUrl: config.push.siteOrigin ? `${config.push.siteOrigin}/brand/favicon-192.png` : "",
        });
        return { device, result: await sendWithRetry(account, body, fetchImpl, accessToken) };
      })
    );
    let okInGroup = 0;
    let fatalInGroup = 0;
    for (const { device, result } of results) {
      const bucket = device.platform === "web" ? "web" : "android";
      if (result.ok) { inc[`counts.${bucket}.sent`] += 1; okInGroup += 1; continue; }
      inc[`counts.${bucket}.failed`] += 1;
      lastError = result.code;
      if (result.kind === "invalidToken") dead.push(device._id);
      if (result.kind === "fatal") fatalInGroup += 1;
    }
    cursor = group[group.length - 1]._id;
    // Every message of a group failing for a configuration reason (wrong project, bad credentials) means the rest would
    // fail too: stop instead of using up requests, and keep every token (it is the setup that is wrong, not the devices).
    const sentSoFar = (note.counts?.android?.sent || 0) + (note.counts?.web?.sent || 0) + inc["counts.android.sent"] + inc["counts.web.sent"];
    if (okInGroup === 0 && fatalInGroup === group.length && sentSoFar === 0) aborted = true;
  }

  if (dead.length) inc["counts.removed"] += await deleteDevicesByIds(config, dead);

  const sentTotal = (note.counts?.android?.sent || 0) + (note.counts?.web?.sent || 0) + inc["counts.android.sent"] + inc["counts.web.sent"];
  const failedTotal = (note.counts?.android?.failed || 0) + (note.counts?.web?.failed || 0) + inc["counts.android.failed"] + inc["counts.web.failed"];
  const exhausted = devices.length < batch;

  let status = "sending";
  let completedAt;
  if (aborted) { status = "failed"; completedAt = new Date(); }
  else if (exhausted) {
    status = sentTotal === 0 && failedTotal > 0 ? "failed" : failedTotal > 0 ? "completed_with_errors" : "completed";
    completedAt = new Date();
  }
  for (const k of Object.keys(inc)) if (inc[k] === 0) delete inc[k];

  await finishChunk(config, note._id, { cursor, inc, status, completedAt, lastError });
  return findNotification(config, id);
}

/**
 * Cron helper: sends ONE more chunk of the oldest unfinished notification (one chunk per run keeps the run inside the
 * Worker's outgoing-request limit). Never throws.
 */
export async function processPending(config, deps = {}) {
  try {
    if (!isPushConfigured(config)) return { processed: 0 };
    const [next] = await listUnfinished(config, deps.now ? deps.now() : new Date(), 1);
    if (!next) return { processed: 0 };
    await runChunk(config, next._id, deps);
    return { processed: 1 };
  } catch (err) {
    console.error("Push continue failed:", err?.code || err?.message);
    return { processed: 0 };
  }
}
