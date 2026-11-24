/**
 * Phase 3 (push notifications): pure rules shared by the controllers, the dispatcher and the tests.
 * Nothing here touches the network or the database.
 */

export const PLATFORMS = ["android", "web"];
/** What a user can switch on / off. Every notification belongs to exactly one of these. */
export const CATEGORIES = ["posts", "courses", "live", "announcements"];
/** Events the system can send by itself (each one can be switched off by the admin). */
export const AUTO_EVENTS = ["posts", "courses", "liveNew", "liveStart"];

export const LIMITS = { title: 100, body: 300, link: 512 };

/** FCM registration tokens are ~140-200 characters of [A-Za-z0-9_-:]. Anything else is not a token. */
const TOKEN_RE = /^[A-Za-z0-9_:.\-]{40,4096}$/;
const INSTALL_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

function fail(message, code = "INVALID_INPUT") {
  return { message, code };
}

export const isValidToken = (t) => typeof t === "string" && TOKEN_RE.test(t);
export const isValidInstallId = (v) => typeof v === "string" && INSTALL_ID_RE.test(v);
export const isValidRequestId = (v) => typeof v === "string" && REQUEST_ID_RE.test(v);

/** Everything on by default; only an explicit `false` turns a switch off. */
export function defaultPrefs() {
  return { enabled: true, posts: true, courses: true, live: true, announcements: true };
}

/** Keeps only the known switches, as booleans. Unknown keys / wrong types are dropped. */
export function normalizePrefs(input, base = defaultPrefs()) {
  const out = { ...defaultPrefs(), ...base };
  if (input && typeof input === "object") {
    for (const key of ["enabled", ...CATEGORIES]) {
      if (typeof input[key] === "boolean") out[key] = input[key];
    }
  }
  return out;
}

/** POST /api/public/push/register */
export function validateRegistration(body) {
  const errors = [];
  if (!body || typeof body !== "object") return { errors: [fail("Request body must be a JSON object.")], value: null };
  if (!PLATFORMS.includes(body.platform)) errors.push(fail("platform must be \"android\" or \"web\"."));
  if (!isValidToken(body.token)) errors.push(fail("token is missing or not a valid push token.", "INVALID_TOKEN"));
  if (body.installId !== undefined && body.installId !== null && !isValidInstallId(body.installId)) errors.push(fail("installId is not valid."));
  if (body.prefs !== undefined && (body.prefs === null || typeof body.prefs !== "object" || Array.isArray(body.prefs))) errors.push(fail("prefs must be an object."));
  if (errors.length) return { errors, value: null };
  return {
    errors,
    value: {
      platform: body.platform,
      token: body.token,
      installId: body.installId || null,
      prefs: body.prefs === undefined ? null : normalizePrefs(body.prefs),
    },
  };
}

/** PUT /api/public/push/preferences and POST /api/public/push/unregister */
export function validateTokenOnly(body) {
  if (!body || typeof body !== "object" || !isValidToken(body.token)) return { errors: [fail("token is missing or not a valid push token.", "INVALID_TOKEN")], value: null };
  return { errors: [], value: { token: body.token } };
}

/**
 * A notification may only open a page of the AthariTV site itself. Accepts:
 *   - a path such as "/article/my-post" (query / hash allowed),
 *   - or a full https URL on the site's own origin, which is reduced to its path.
 * Rejects other hosts, "//host" tricks, backslashes, control characters, javascript: / data: URLs and the admin panel.
 * Returns the safe path, "" for "no link", or null when the value is not acceptable.
 */
export function sanitizeLink(value, siteOrigin) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  let link = value.trim();
  if (!link) return "";
  if (link.length > LIMITS.link) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(link)) return null;
  if (/^https?:\/\//i.test(link)) {
    let url;
    try { url = new URL(link); } catch { return null; }
    let site;
    try { site = siteOrigin ? new URL(siteOrigin) : null; } catch { site = null; }
    if (!site || url.protocol !== "https:" || url.host.toLowerCase() !== site.host.toLowerCase() || url.username || url.password) return null;
    link = `${url.pathname}${url.search}${url.hash}`;
  }
  if (!link.startsWith("/") || link.startsWith("//")) return null;
  if (/^\/admin(\/|$|\?|#)/i.test(link)) return null;
  return link;
}

const clean = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();

/** POST /api/admin/notifications */
export function validateNotificationInput(body, { siteOrigin } = {}) {
  const errors = [];
  if (!body || typeof body !== "object") return { errors: [fail("Request body must be a JSON object.")], value: null };

  const title = clean(body.title);
  const text = clean(body.body);
  if (!title) errors.push(fail("Title is required."));
  if (title.length > LIMITS.title) errors.push(fail(`Title can be at most ${LIMITS.title} characters.`));
  if (!text) errors.push(fail("Message is required."));
  if (text.length > LIMITS.body) errors.push(fail(`Message can be at most ${LIMITS.body} characters.`));
  if (!CATEGORIES.includes(body.category)) errors.push(fail(`category must be one of: ${CATEGORIES.join(", ")}.`));

  const platforms = Array.isArray(body.platforms) ? [...new Set(body.platforms)] : [];
  if (platforms.length === 0 || platforms.some((p) => !PLATFORMS.includes(p))) errors.push(fail("Choose at least one platform (android, web)."));

  const link = sanitizeLink(body.link, siteOrigin);
  if (link === null) errors.push(fail("The link must be a page of this website (for example /article/my-post).", "INVALID_LINK"));

  if (body.clientRequestId !== undefined && !isValidRequestId(body.clientRequestId)) errors.push(fail("clientRequestId is not valid."));

  if (errors.length) return { errors, value: null };
  return {
    errors,
    value: { title, body: text, category: body.category, platforms, link: link || "", clientRequestId: body.clientRequestId || null },
  };
}

/** PUT /api/admin/notifications/auto-settings */
export function validateAutoSettings(body) {
  if (!body || typeof body !== "object") return { errors: [fail("Request body must be a JSON object.")], value: null };
  const value = {};
  for (const key of AUTO_EVENTS) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") return { errors: [fail(`${key} must be true or false.`)], value: null };
      value[key] = body[key];
    }
  }
  if (Object.keys(value).length === 0) return { errors: [fail("Nothing to update.")], value: null };
  return { errors: [], value };
}

/** How long FCM may keep a message for a device that is offline. A live-start alert is useless after an hour. */
export function ttlSecondsFor(category, kind) {
  if (kind === "liveStart") return 60 * 60;
  return 2 * 24 * 60 * 60;
}

/** Cuts text to `max` characters without splitting a surrogate pair. */
export function clip(text, max) {
  const chars = Array.from(String(text ?? ""));
  return chars.length <= max ? chars.join("") : `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

/**
 * The two FCM v1 message bodies for one device token. Values in `data` must all be strings.
 *  - Android: a "notification" message. This is what lets the phone's own system tray show it while the app is closed
 *    or in the background; the tap opens the app and `data.link` says which page.
 *  - Web: data only. The service worker shows the notification itself (and handles the click), so nothing is shown twice.
 */
export function buildFcmMessage({ platform, token, notification, siteOrigin, iconUrl }) {
  const { id, title, body, link, category, kind } = notification;
  const ttl = ttlSecondsFor(category, kind);
  const data = { nid: String(id), category: String(category), link: link || "/" };
  if (platform === "android") {
    return {
      message: {
        token,
        notification: { title: clip(title, LIMITS.title), body: clip(body, LIMITS.body) },
        data,
        android: {
          priority: "HIGH",
          ttl: `${ttl}s`,
          notification: { channel_id: "atharitv_default", tag: String(id) },
        },
      },
    };
  }
  return {
    message: {
      token,
      data: { ...data, title: clip(title, LIMITS.title), body: clip(body, LIMITS.body), icon: iconUrl || "" },
      webpush: { headers: { TTL: String(ttl), Urgency: "high" } },
    },
  };
}
