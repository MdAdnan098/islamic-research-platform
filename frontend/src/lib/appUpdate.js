/**
 * Android app update logic (Phase 2). Pure functions, no React, no network of its own: everything the update
 * check needs is passed in, so every scenario (optional / mandatory / none / offline / server error) is unit-tested.
 *
 * IMPORTANT: "version" here is the version of the ANDROID APP (native wrapper), read from the installed app itself.
 * It is NOT a website version: the website is loaded remotely and updates on every deployment, with no new APK.
 */

const VERSION_RE = /^\d{1,4}(?:\.\d{1,4}){0,3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // "Later" hides the same version's dialog for 3 days
export const RECHECK_MS = 6 * 60 * 60 * 1000; // coming back to the app re-checks at most every 6 hours
export const STORAGE_KEY = "fs_app_update";
const MAX_NOTES = 20;
const MAX_NOTE_LENGTH = 300;

/* ------------------------------- versions ------------------------------- */

export const isValidVersion = (v) => typeof v === "string" && VERSION_RE.test(v.trim());

export function parseVersion(v) {
  if (!isValidVersion(v)) return null;
  const parts = v.trim().split(".").map((n) => Number.parseInt(n, 10));
  while (parts.length < 4) parts.push(0);
  return parts;
}

/** -1 / 0 / 1, or null if either side is not a valid version. "1.0" equals "1.0.0"; 1.10 is newer than 1.9. */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 4; i += 1) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

/** Native versionName such as "1.2.0", "v1.2" or "1.2.0-debug" -> "1.2.0" / "1.2" ; null when it has no leading number. */
export function normalizeInstalledVersion(name) {
  const m = /^\s*v?(\d{1,4}(?:\.\d{1,4}){0,3})/.exec(String(name ?? ""));
  return m ? m[1] : null;
}

/* --------------------------------- urls --------------------------------- */

const isIpLiteral = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || h.startsWith("[");

/** https only, no credentials, a real public host name. (The server and the native side check the same rules.) */
export function isSafeDownloadUrl(value) {
  if (typeof value !== "string" || !value || value.length > 2048) return false;
  let u;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  return !(isIpLiteral(h) || h === "localhost" || !h.includes(".") || h.endsWith(".local") || h.endsWith(".internal"));
}

/** Where "Update now" goes: the store listing if one is configured, otherwise the official APK link. null = nowhere safe. */
export function pickUpdateUrl(release) {
  if (!release) return null;
  for (const u of [release.storeUrl, release.downloadUrl]) if (isSafeDownloadUrl(u)) return u;
  return null;
}

/* ------------------------------ release data ------------------------------ */

/**
 * Validates what came from the network / the saved copy. null / undefined = "no release published" (valid).
 * Anything malformed throws, so a broken response is treated like any other failed check (never a half-shown dialog).
 */
export function sanitizeRelease(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("INVALID_RELEASE");
  const latestVersion = typeof raw.latestVersion === "string" ? raw.latestVersion.trim() : "";
  if (!isValidVersion(latestVersion)) throw new Error("INVALID_RELEASE");
  const min = typeof raw.minSupportedVersion === "string" && raw.minSupportedVersion.trim() ? raw.minSupportedVersion.trim() : null;
  if (min !== null && !isValidVersion(min)) throw new Error("INVALID_RELEASE");
  const notes = Array.isArray(raw.releaseNotes)
    ? raw.releaseNotes.filter((n) => typeof n === "string" && n.trim()).slice(0, MAX_NOTES).map((n) => n.trim().slice(0, MAX_NOTE_LENGTH))
    : [];
  return {
    latestVersion,
    minSupportedVersion: min,
    releaseDate: typeof raw.releaseDate === "string" && DATE_RE.test(raw.releaseDate) ? raw.releaseDate : null,
    releaseNotes: notes,
    downloadUrl: typeof raw.downloadUrl === "string" ? raw.downloadUrl : "",
    storeUrl: typeof raw.storeUrl === "string" ? raw.storeUrl : "",
    mandatory: raw.mandatory === true,
  };
}

/**
 * Decides what the installed app should do about a release.
 *  - "none":      up to date (or newer), nothing published, or the installed version is unknown
 *  - "optional":  a newer version exists
 *  - "mandatory": a newer version exists AND (the admin marked it mandatory OR the installed version is below the minimum supported one)
 * An update is never "mandatory" when there is no safe place to get it from: that would trap the user.
 */
export function evaluateRelease(release, installed) {
  if (!release) return { status: "none", reason: "no-release" };
  const cmp = compareVersions(release.latestVersion, installed);
  if (cmp === null) return { status: "none", reason: "bad-version" };
  if (cmp <= 0) return { status: "none", reason: "up-to-date" };
  if (!pickUpdateUrl(release)) return { status: "none", reason: "no-safe-url" };
  const belowMin = release.minSupportedVersion ? compareVersions(release.minSupportedVersion, installed) > 0 : false;
  return { status: release.mandatory || belowMin ? "mandatory" : "optional", reason: belowMin ? "below-minimum" : release.mandatory ? "marked-mandatory" : "newer" };
}

/* ------------------------- saved state (localStorage) ------------------------- */

function readState(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}
function writeState(storage, patch) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify({ ...readState(storage), ...patch })); } catch { /* storage unavailable: just don't remember */ }
}

/** Remembers that the user chose "Later" for this version. */
export function snoozeVersion(storage, version, now = Date.now()) {
  writeState(storage, { dismissedVersion: version, dismissedAt: now });
}
export function isSnoozed(storage, version, now = Date.now()) {
  const s = readState(storage);
  return s.dismissedVersion === version && Number.isFinite(s.dismissedAt) && now - s.dismissedAt >= 0 && now - s.dismissedAt < SNOOZE_MS;
}
/** The last release the server told us about (public data only). Used ONLY to keep a mandatory update enforced while offline. */
function readCachedRelease(storage) {
  try { return sanitizeRelease(readState(storage).release); } catch { return undefined; }
}

/* ------------------------------ the whole check ------------------------------ */

/**
 * @param {object}   o
 * @param {string}   o.installedVersionName  versionName read from the installed native app
 * @param {Function} o.fetchRelease          () => Promise<release|null>, rejects when offline / the server fails
 * @param {Storage}  [o.storage]             localStorage (optional)
 * @param {number}   [o.now]
 * @returns {Promise<{status:"none"|"optional"|"mandatory", release?:object, installed?:string, source?:string, reason?:string}>}
 * Never throws: a failed check must not get in the way of using the app.
 */
export async function runUpdateCheck({ installedVersionName, fetchRelease, storage, now = Date.now() }) {
  const installed = normalizeInstalledVersion(installedVersionName);
  if (!installed) return { status: "none", reason: "unknown-installed-version" };

  let release;
  let source = "network";
  try {
    release = sanitizeRelease(await fetchRelease());
    writeState(storage, { release, checkedAt: now });
  } catch {
    // Offline, server error or a broken response. The saved copy is used for ONE thing only: a mandatory update that
    // was already announced stays enforced. Everything else is skipped quietly.
    const cached = readCachedRelease(storage);
    if (!cached) return { status: "none", reason: "check-failed", installed };
    release = cached;
    source = "cache";
  }

  const verdict = evaluateRelease(release, installed);
  if (verdict.status === "none") return { ...verdict, installed, source };
  if (verdict.status === "optional") {
    if (source === "cache") return { status: "none", reason: "offline-optional-skipped", installed, source };
    if (isSnoozed(storage, release.latestVersion, now)) return { status: "none", reason: "snoozed", installed, source };
  }
  return { status: verdict.status, reason: verdict.reason, release, installed, source };
}
