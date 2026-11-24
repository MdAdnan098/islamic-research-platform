/**
 * Android app release rules (Phase 2: app update system). Dependency-free, shared by the controller and the tests.
 *
 * IMPORTANT: this is the version of the ANDROID APP (the native wrapper), never the website. The website is loaded
 * remotely inside the app and updates itself on every deployment; only native changes need a new APK.
 */

/** Dotted numeric version with 1-4 parts, each 1-4 digits: "1", "1.0", "1.2.3", "1.2.3.4". */
const VERSION_RE = /^\d{1,4}(?:\.\d{1,4}){0,3}$/;

export const MAX_NOTES = 20;
export const MAX_NOTE_LENGTH = 300;
export const MAX_URL_LENGTH = 2048;

export function isValidVersion(value) {
  return typeof value === "string" && VERSION_RE.test(value.trim());
}

/** "1.2" -> [1,2,0,0]. Returns null for anything that is not a valid version. */
export function parseVersion(value) {
  if (!isValidVersion(value)) return null;
  const parts = value.trim().split(".").map((n) => Number.parseInt(n, 10));
  while (parts.length < 4) parts.push(0);
  return parts;
}

/** -1 / 0 / 1, or null when either side is not a valid version. "1.0" equals "1.0.0". */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 4; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/** Host allow-list entries: "example.com" matches example.com and any subdomain of it. */
export function parseAllowedHosts(raw) {
  return String(raw || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

const isIpLiteral = (host) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[");

/**
 * Validates an official download / store URL. Returns an error message, or null when the URL is acceptable.
 * HTTPS only, no credentials in the URL, no IP-address / localhost / single-label hosts, and - when
 * APP_UPDATE_ALLOWED_HOSTS is configured - only those hosts (or their subdomains).
 */
export function validateDownloadUrl(value, allowedHosts = []) {
  if (typeof value !== "string") return "The URL must be text.";
  const text = value.trim();
  if (text.length === 0) return null;
  if (text.length > MAX_URL_LENGTH) return "The URL is too long.";
  let url;
  try { url = new URL(text); } catch { return "The URL is not valid."; }
  if (url.protocol !== "https:") return "Only https:// URLs are allowed.";
  if (url.username || url.password) return "The URL must not contain a username or password.";
  const host = url.hostname.toLowerCase();
  if (isIpLiteral(host) || host === "localhost" || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "The URL must use a public website name (not an IP address or localhost).";
  }
  if (allowedHosts.length > 0 && !allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    return `This host is not allowed. Allowed: ${allowedHosts.join(", ")}.`;
  }
  return null;
}

function parseReleaseDate(value) {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false };
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return { ok: false };
  return { ok: true, value };
}

function normalizeNotes(value) {
  if (value === undefined || value === null || value === "") return { ok: true, value: [] };
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : null;
  if (!list) return { ok: false, message: "Release notes must be a list of lines." };
  const lines = [];
  for (const item of list) {
    if (typeof item !== "string") return { ok: false, message: "Release notes must be text." };
    const line = item.trim();
    if (!line) continue;
    if (line.length > MAX_NOTE_LENGTH) return { ok: false, message: `Each release note line must be at most ${MAX_NOTE_LENGTH} characters.` };
    lines.push(line);
  }
  if (lines.length > MAX_NOTES) return { ok: false, message: `At most ${MAX_NOTES} release note lines.` };
  return { ok: true, value: lines };
}

/**
 * Validates + normalizes an admin's release form. Returns { errors: [{message, code}], value }.
 * `value` is only meaningful when `errors` is empty.
 */
export function validateReleaseInput(body, { allowedHosts = [] } = {}) {
  const errors = [];
  const fail = (message, code = "INVALID_INPUT") => errors.push({ message, code });
  if (!body || typeof body !== "object" || Array.isArray(body)) return { errors: [{ message: "Request body must be a JSON object.", code: "INVALID_INPUT" }], value: null };

  const latestVersion = typeof body.latestVersion === "string" ? body.latestVersion.trim() : "";
  if (!isValidVersion(latestVersion)) fail("Latest version must look like 1.2 or 1.2.3 (numbers and dots only).", "INVALID_VERSION");

  let minSupportedVersion = null;
  if (body.minSupportedVersion !== undefined && body.minSupportedVersion !== null && String(body.minSupportedVersion).trim() !== "") {
    minSupportedVersion = typeof body.minSupportedVersion === "string" ? body.minSupportedVersion.trim() : "";
    if (!isValidVersion(minSupportedVersion)) fail("Minimum supported version must look like 1.2 or 1.2.3 (numbers and dots only).", "INVALID_VERSION");
    else if (isValidVersion(latestVersion) && compareVersions(minSupportedVersion, latestVersion) > 0) {
      fail("Minimum supported version cannot be higher than the latest version.", "INVALID_VERSION");
    }
  }

  const date = parseReleaseDate(body.releaseDate);
  if (!date.ok) fail("Release date must be a real date in YYYY-MM-DD format.");

  const notes = normalizeNotes(body.releaseNotes);
  if (!notes.ok) fail(notes.message);

  const downloadUrl = typeof body.downloadUrl === "string" ? body.downloadUrl.trim() : body.downloadUrl == null ? "" : null;
  const storeUrl = typeof body.storeUrl === "string" ? body.storeUrl.trim() : body.storeUrl == null ? "" : null;
  for (const [label, v] of [["APK download URL", downloadUrl], ["Store URL", storeUrl]]) {
    if (v === null) { fail(`${label} must be text.`, "INVALID_URL"); continue; }
    const problem = validateDownloadUrl(v, allowedHosts);
    if (problem) fail(`${label}: ${problem}`, "INVALID_URL");
  }

  for (const key of ["mandatory", "published"]) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") fail(`"${key}" must be true or false.`);
  }
  const mandatory = body.mandatory === true;
  const published = body.published === true;

  if (published && !downloadUrl && !storeUrl) {
    fail("Add an official APK download URL (or a store URL) before publishing, so users always have somewhere to update from.", "URL_REQUIRED");
  }

  return {
    errors,
    value: errors.length ? null : {
      latestVersion,
      minSupportedVersion,
      releaseDate: date.value,
      releaseNotes: notes.value,
      downloadUrl: downloadUrl || "",
      storeUrl: storeUrl || "",
      mandatory,
      published,
    },
  };
}
