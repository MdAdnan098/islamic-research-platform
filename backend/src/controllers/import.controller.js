import { loadConfig } from "../config/env.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { jsonSuccess } from "../utils/response.js";
import { fetchImportImage, fetchImportPage, importError } from "../utils/safeFetch.js";

/**
 * Automatic Article Importer - P1: a hardened fetch proxy for the admin panel.
 *
 *   POST /api/admin/import/page   { url } -> JSON { finalUrl, contentType, body }   (HTML / XHTML / JSON text)
 *   POST /api/admin/import/image  { url } -> the image bytes (jpeg / png / webp / gif / avif), Content-Type = sniffed type
 *
 * Both routes sit under /api/admin/, so the router's guardAdmin already refuses anonymous callers; requireAdmin
 * is repeated here like in every other controller. They only READ from the given site: nothing is written to
 * MongoDB or R2, and no article is created or published. All URL / redirect / size / type rules live in
 * utils/safeFetch.js; the caller can only choose the URL, never limits, headers or methods.
 */

const MAX_REQUEST_BODY_BYTES = 8 * 1024;

/** Reads the request body but stops at `max` bytes, whatever Content-Length says (chunked uploads have none). */
async function readBodyText(request, max) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      reader.cancel().catch(() => {});
      throw importError("IMPORT_TOO_LARGE", "The request body is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readTargetUrl(request) {
  let body = null;
  try {
    body = JSON.parse(await readBodyText(request, MAX_REQUEST_BODY_BYTES));
  } catch (e) {
    if (e?.code === "IMPORT_TOO_LARGE") throw e;
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.url !== "string") {
    throw importError("IMPORT_URL_INVALID", "Request body must be a JSON object with a url string.");
  }
  return body.url;
}

/** CORS for the binary response (jsonSuccess adds these itself for JSON). Same rules as utils/response.js. */
function corsHeaders(allowedOrigin) {
  if (!allowedOrigin) return { Vary: "Origin" };
  return {
    Vary: "Origin",
    "Access-Control-Allow-Origin": allowedOrigin,
    ...(allowedOrigin !== "*" ? { "Access-Control-Allow-Credentials": "true" } : {}),
  };
}

/** POST /api/admin/import/page */
export async function page(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const result = await fetchImportPage(await readTargetUrl(request));
  return jsonSuccess(
    { finalUrl: result.finalUrl, contentType: result.contentType, body: result.body },
    { allowedOrigin: config.allowedOrigin }
  );
}

/** POST /api/admin/import/image */
export async function image(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  const result = await fetchImportImage(await readTargetUrl(request));
  return new Response(result.bytes, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...corsHeaders(config.allowedOrigin),
    },
  });
}
