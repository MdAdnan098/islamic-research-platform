/**
 * Phase 3 - the website / app side of push notifications: everything that can be decided WITHOUT a browser API or the
 * network, so it is easy to test. pushClient.js does the actual permission / token work.
 */

export const STORAGE_KEY = "fs_push";
export const CATEGORIES = ["posts", "courses", "live", "announcements"];
/** After "Not now" the prompt stays away for this long. */
export const PROMPT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
/** The prompt is only offered from the visitor's 2nd visit, never on the very first page. */
export const MIN_VISITS_BEFORE_PROMPT = 2;
/** A new visit = no visit counted in the last 30 minutes. */
export const VISIT_GAP_MS = 30 * 60 * 1000;

export const defaultPrefs = () => ({ enabled: true, posts: true, courses: true, live: true, announcements: true });

export function normalizePrefs(input) {
  const out = defaultPrefs();
  if (input && typeof input === "object") for (const k of ["enabled", ...CATEGORIES]) if (typeof input[k] === "boolean") out[k] = input[k];
  return out;
}

export function newInstallId() {
  const bytes = new Uint8Array(16);
  (globalThis.crypto || { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Saved choice of this device. Only local convenience data - the server holds the token and the preferences. */
export function emptyState() {
  return { installId: "", token: "", enabled: false, prefs: defaultPrefs(), asked: false, dismissedAt: 0, visits: 0, lastVisitAt: 0 };
}

export function loadState(storage) {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return emptyState();
    return {
      installId: typeof raw.installId === "string" ? raw.installId : "",
      token: typeof raw.token === "string" ? raw.token : "",
      enabled: raw.enabled === true,
      prefs: normalizePrefs(raw.prefs),
      asked: raw.asked === true,
      dismissedAt: Number(raw.dismissedAt) || 0,
      visits: Number(raw.visits) || 0,
      lastVisitAt: Number(raw.lastVisitAt) || 0,
    };
  } catch {
    return emptyState();
  }
}

export function saveState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode / storage full: the choice is just not remembered */ }
  return state;
}

/** Counts a visit (at most one per VISIT_GAP_MS). Returns the new state. */
export function countVisit(state, now = Date.now()) {
  if (state.lastVisitAt && now - state.lastVisitAt < VISIT_GAP_MS) return { ...state, lastVisitAt: now };
  return { ...state, visits: state.visits + 1, lastVisitAt: now };
}

/**
 * Should the "turn on notifications?" card be shown now?
 * permission: "default" | "granted" | "denied" | "unsupported" (browser Notification.permission, or the app's answer)
 */
export function shouldPrompt(state, { permission, serverEnabled, now = Date.now(), path = "/" }) {
  if (!serverEnabled) return false;
  if (permission !== "default") return false; // already allowed, blocked in the browser / phone settings, or not possible
  if (state.enabled) return false;
  if (path.startsWith("/admin")) return false;
  if (state.visits < MIN_VISITS_BEFORE_PROMPT) return false;
  if (state.dismissedAt && now - state.dismissedAt < PROMPT_COOLDOWN_MS) return false;
  return true;
}

/** Only a page of this website may be opened from a notification. Mirrors the server and the Android code. */
export function safeInternalPath(link) {
  if (typeof link !== "string") return null;
  const value = link.trim();
  if (!value || value.length > 512 || !value.startsWith("/") || value.startsWith("//")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  if (/^\/admin(\/|$|\?|#)/i.test(value)) return null;
  return value;
}

/**
 * What website push can do in this browser.
 *  "ok"            -> can ask for permission
 *  "needs-install" -> iPhone / iPad Safari: only works after "Add to Home Screen" (iOS 16.4+)
 *  "unsupported"   -> no service workers / Push API / Notification API
 * `env` is injected for tests: { hasServiceWorker, hasPush, hasNotification, userAgent, platform, maxTouchPoints, standalone }
 */
export function webPushSupport(env) {
  const ua = String(env.userAgent || "");
  const isIos = /iPad|iPhone|iPod/.test(ua) || (env.platform === "MacIntel" && Number(env.maxTouchPoints) > 1);
  if (isIos && !env.standalone) return "needs-install";
  if (!env.hasServiceWorker || !env.hasPush || !env.hasNotification) return "unsupported";
  return "ok";
}

/** Text of the in-app banner (foreground). Everything is cut to a sane length and treated as plain text. */
export function bannerFrom(data) {
  const clip = (s, n) => String(s ?? "").slice(0, n);
  const title = clip(data?.title, 100).trim();
  const body = clip(data?.body, 300).trim();
  if (!title && !body) return null;
  return { title: title || body, body: title ? body : "", link: safeInternalPath(data?.link) || "" };
}
