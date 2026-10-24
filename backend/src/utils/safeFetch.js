/**
 * SSRF-hardened fetch for the Automatic Article Importer (phase P1).
 *
 * The importer lets a signed-in admin ask the Worker to download a public article page or one of its images.
 * Because the URL is chosen by the caller, every URL (the first one AND every redirect target) goes through
 * validateImportUrl() before any request is made, and every response is bounded in time, size and type.
 *
 * What this module DOES guarantee
 *   - only http(s) URLs on the standard web ports (80 / 443), no credentials inside the URL;
 *   - no IP-address hosts at all (IPv4 in any notation, IPv6), no single-label / internal-looking host names
 *     (localhost, *.local, *.internal, ...) and a short list of well-known "wildcard DNS to any IP" services;
 *   - redirects are followed manually (max 3), each target is re-validated, https -> http downgrades are refused;
 *   - nothing from the caller is forwarded: no cookies, no Authorization, no caller-supplied headers;
 *   - one deadline covers the whole request chain AND the body download;
 *   - the body is counted while it is read and the download stops at the cap (a lying or missing Content-Length
 *     cannot bypass it); the count is on decompressed bytes, so compression bombs are capped as well;
 *   - pages: text/html, application/xhtml+xml or application/json only; images: jpeg/png/webp/gif/avif only,
 *     and the file's magic bytes must match the declared type (the sniffed type is what is returned);
 *   - errors carry fixed, caller-safe messages: nothing from the upstream site (body, headers, URL, network
 *     error text) is ever reflected back.
 *
 * What it can NOT guarantee (documented limitation, see the P1 report)
 *   - Workers do not expose DNS resolution, so a public-looking name that RESOLVES to a private address (or
 *     changes its answer between our check and the connection: DNS rebinding) cannot be detected here.
 *     The host-name rules above reduce, but do not remove, that risk.
 */

export const IMPORT_LIMITS = Object.freeze({
  pageMaxBytes: 5 * 1024 * 1024,
  imageMaxBytes: 20 * 1024 * 1024, // same as the media upload limit (media.controller.js)
  pageTimeoutMs: 10_000,
  imageTimeoutMs: 15_000,
  maxRedirects: 3,
  maxUrlLength: 2048,
});

const STATUS_BY_CODE = {
  IMPORT_URL_INVALID: 400,
  IMPORT_BLOCKED_HOST: 403,
  IMPORT_TOO_LARGE: 413,
  IMPORT_UNSUPPORTED_TYPE: 415,
  IMPORT_UPSTREAM_ERROR: 502,
  IMPORT_TIMEOUT: 504,
};

/** Error in the shape the router's error handler understands ({ status, code, message }). */
export function importError(code, message) {
  const err = new Error(message);
  err.status = STATUS_BY_CODE[code] ?? 500;
  err.code = code;
  return err;
}

const isImportError = (e) => typeof e?.code === "string" && e.code in STATUS_BY_CODE;

/* ------------------------------------------------------------------------------------------------ */
/* URL validation                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

// Last DNS label that can never be a public site (private-use / special-use names).
const BLOCKED_LAST_LABELS = new Set([
  "localhost", "local", "internal", "localdomain", "lan", "home", "corp", "intranet", "arpa", "invalid", "test", "example", "onion",
]);

// Public services that resolve ANY sub-name to an address chosen by the caller (e.g. 127.0.0.1.nip.io).
// This is a partial mitigation only: it cannot list every such service.
const WILDCARD_IP_DNS = ["nip.io", "sslip.io", "xip.io", "localtest.me", "lvh.me", "vcap.me"];

const IPV4_RE = /^\d+(?:\.\d+){3}$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Parses and checks one URL. Returns the parsed URL (fragment removed) or throws an import error.
 * The returned URL's `href` is what must be fetched, so the host that was checked is the host that is used.
 */
export function validateImportUrl(raw) {
  if (typeof raw !== "string") throw importError("IMPORT_URL_INVALID", "A URL is required.");
  const text = raw.trim();
  if (!text || text.length > IMPORT_LIMITS.maxUrlLength) throw importError("IMPORT_URL_INVALID", "The URL is empty or too long.");

  let url;
  try {
    url = new URL(text);
  } catch {
    throw importError("IMPORT_URL_INVALID", "That is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw importError("IMPORT_URL_INVALID", "Only http and https URLs can be imported.");
  }
  if (url.username || url.password) {
    throw importError("IMPORT_URL_INVALID", "URLs that contain a user name or password are not allowed.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw importError("IMPORT_BLOCKED_HOST", "Only standard web ports are allowed.");
  }

  // WHATWG parsing has already lower-cased the host, converted IDNs to punycode and normalised numeric
  // IPv4 spellings (127.1, 2130706433, 0x7f000001, 0177.0.0.1 -> 127.0.0.1).
  let host = url.hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);

  if (!host) throw importError("IMPORT_URL_INVALID", "The URL has no host name.");
  if (host.startsWith("[") || host.includes(":") || IPV4_RE.test(host)) {
    throw importError("IMPORT_BLOCKED_HOST", "IP addresses cannot be imported; use the site's host name.");
  }
  if (host.length > 253) throw importError("IMPORT_URL_INVALID", "The host name is too long.");

  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL_RE.test(l))) {
    throw importError("IMPORT_BLOCKED_HOST", "That host name is not allowed.");
  }
  const last = labels[labels.length - 1];
  if (!/^[a-z]/.test(last) || BLOCKED_LAST_LABELS.has(last)) {
    throw importError("IMPORT_BLOCKED_HOST", "That host name is not allowed.");
  }
  if (WILDCARD_IP_DNS.some((d) => host === d || host.endsWith(`.${d}`))) {
    throw importError("IMPORT_BLOCKED_HOST", "That host name is not allowed.");
  }

  url.hash = "";
  return url;
}

/* ------------------------------------------------------------------------------------------------ */
/* Content-type handling                                                                             */
/* ------------------------------------------------------------------------------------------------ */

const PAGE_TYPES = new Set(["text/html", "application/xhtml+xml", "application/json"]);
const IMAGE_TYPE_ALIASES = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  "image/avif": "image/avif",
};

const mediaTypeOf = (header) => String(header || "").split(";")[0].trim().toLowerCase();

const ascii = (bytes, from, to) => {
  let s = "";
  for (let i = from; i < to && i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return s;
};

/** Identifies an image from its first bytes. Returns a MIME type or null. SVG and anything else -> null. */
export function sniffImageType(b) {
  if (!b || b.length < 3) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return "image/gif";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp") {
    const boxSize = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    const brands = ascii(b, 8, Math.min(b.length, boxSize > 12 ? boxSize : 32, 64));
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
  }
  return null;
}

function decodePage(bytes, contentTypeHeader) {
  let label = /charset\s*=\s*["']?([\w:.-]+)/i.exec(contentTypeHeader || "")?.[1];
  if (!label) {
    // No charset in the header: look for <meta charset=...> in the first bytes (older Urdu / Arabic sites).
    const head = new TextDecoder("windows-1252").decode(bytes.subarray(0, 2048));
    label = /<meta[^>]+charset\s*=\s*["']?\s*([\w:.-]+)/i.exec(head)?.[1];
  }
  let decoder;
  try {
    decoder = new TextDecoder(label || "utf-8");
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  return decoder.decode(bytes);
}

/* ------------------------------------------------------------------------------------------------ */
/* Deadline + bounded body reading                                                                   */
/* ------------------------------------------------------------------------------------------------ */

/** One deadline for the whole operation. race() also guards against a fetch/stream that ignores the abort signal. */
function createDeadline(ms) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const expired = new Promise((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(importError("IMPORT_TIMEOUT", "The site took too long to respond.")), { once: true });
  });
  expired.catch(() => {}); // never an unhandled rejection when nothing is racing it
  return {
    signal: controller.signal,
    get timedOut() { return timedOut; },
    race: (promise) => Promise.race([promise, expired]),
    abort: () => controller.abort(),
    clear: () => clearTimeout(timer),
  };
}

function discardBody(response) {
  try {
    const p = response?.body?.cancel?.();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    /* nothing to free */
  }
}

function concatChunks(chunks, total) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

async function readBounded(response, maxBytes, deadline) {
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    discardBody(response);
    throw importError("IMPORT_TOO_LARGE", "The file is too large to import.");
  }
  if (!response.body) return new Uint8Array(0);

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await deadline.race(reader.read());
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel().catch(() => {});
        deadline.abort();
        throw importError("IMPORT_TOO_LARGE", "The file is too large to import.");
      }
      chunks.push(value);
    }
  } catch (e) {
    reader.cancel().catch(() => {}); // best effort: free the upstream connection (no-op if it is already closed)
    if (isImportError(e)) throw e;
    if (deadline.timedOut) throw importError("IMPORT_TIMEOUT", "The site took too long to respond.");
    throw importError("IMPORT_UPSTREAM_ERROR", "The download from the site failed.");
  }
  const bytes = concatChunks(chunks, total);
  chunks.length = 0;
  return bytes;
}

/* ------------------------------------------------------------------------------------------------ */
/* The fetch itself                                                                                  */
/* ------------------------------------------------------------------------------------------------ */

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const USER_AGENT = "AthariTV-Importer/1.0";

const ACCEPT = {
  page: "text/html,application/xhtml+xml,application/json;q=0.9",
  image: "image/webp,image/png,image/jpeg,image/gif;q=0.9",
};

/**
 * @param {string} rawUrl
 * @param {{ kind: "page"|"image", timeoutMs?: number, maxBytes?: number, maxRedirects?: number, fetch?: Function }} options
 *   Everything except `kind` exists for tests; the controller never passes caller-controlled values.
 */
export async function safeFetch(rawUrl, options = {}) {
  const kind = options.kind;
  if (kind !== "page" && kind !== "image") throw new Error("safeFetch: kind must be \"page\" or \"image\".");

  const timeoutMs = options.timeoutMs ?? (kind === "page" ? IMPORT_LIMITS.pageTimeoutMs : IMPORT_LIMITS.imageTimeoutMs);
  const maxBytes = options.maxBytes ?? (kind === "page" ? IMPORT_LIMITS.pageMaxBytes : IMPORT_LIMITS.imageMaxBytes);
  const maxRedirects = options.maxRedirects ?? IMPORT_LIMITS.maxRedirects;
  // Called as a bare function (never as a method) so it also works with the Workers global fetch.
  const doFetch = options.fetch || ((...args) => globalThis.fetch(...args));

  let current = validateImportUrl(rawUrl);
  const deadline = createDeadline(timeoutMs);

  try {
    let response;
    for (let hop = 0; ; hop += 1) {
      try {
        response = await deadline.race(
          doFetch(current.href, {
            method: "GET",
            redirect: "manual",
            signal: deadline.signal,
            headers: { "User-Agent": USER_AGENT, Accept: ACCEPT[kind] },
          })
        );
      } catch (e) {
        if (isImportError(e)) throw e;
        if (deadline.timedOut) throw importError("IMPORT_TIMEOUT", "The site took too long to respond.");
        throw importError("IMPORT_UPSTREAM_ERROR", "The site could not be reached.");
      }

      if (!REDIRECT_STATUSES.has(response.status)) break;

      discardBody(response);
      if (hop >= maxRedirects) throw importError("IMPORT_UPSTREAM_ERROR", "The site redirected too many times.");
      const location = response.headers.get("location");
      if (!location) throw importError("IMPORT_UPSTREAM_ERROR", "The site sent an invalid redirect.");

      let target;
      try {
        target = new URL(location, current);
      } catch {
        throw importError("IMPORT_UPSTREAM_ERROR", "The site sent an invalid redirect.");
      }
      const next = validateImportUrl(target.href); // the redirect target gets exactly the same checks
      if (current.protocol === "https:" && next.protocol === "http:") {
        throw importError("IMPORT_BLOCKED_HOST", "A redirect to an insecure (http) address was refused.");
      }
      current = next;
    }

    if (!response.ok) {
      discardBody(response);
      throw importError("IMPORT_UPSTREAM_ERROR", `The site responded with HTTP ${response.status}.`);
    }

    const header = response.headers.get("content-type");
    const mediaType = mediaTypeOf(header);
    if (kind === "page" && !PAGE_TYPES.has(mediaType)) {
      discardBody(response);
      throw importError("IMPORT_UNSUPPORTED_TYPE", "That URL does not return a supported page type.");
    }
    if (kind === "image" && !IMAGE_TYPE_ALIASES[mediaType]) {
      discardBody(response);
      throw importError("IMPORT_UNSUPPORTED_TYPE", "That URL does not return a supported image type.");
    }

    const bytes = await readBounded(response, maxBytes, deadline);
    if (bytes.byteLength === 0) throw importError("IMPORT_UPSTREAM_ERROR", "The site returned an empty response.");

    if (kind === "page") {
      return { finalUrl: current.href, contentType: mediaType, body: decodePage(bytes, header) };
    }

    const sniffed = sniffImageType(bytes);
    if (!sniffed || sniffed !== IMAGE_TYPE_ALIASES[mediaType]) {
      throw importError("IMPORT_UNSUPPORTED_TYPE", "The downloaded file is not a supported image.");
    }
    return { finalUrl: current.href, contentType: sniffed, bytes };
  } finally {
    deadline.clear();
  }
}

export const fetchImportPage = (rawUrl, options = {}) => safeFetch(rawUrl, { ...options, kind: "page" });
export const fetchImportImage = (rawUrl, options = {}) => safeFetch(rawUrl, { ...options, kind: "image" });
