import { loadConfig } from "../config/env.js";
import { jsonSuccess } from "../utils/response.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { putObject, getObject } from "../services/storage/r2.service.js";

/**
 * Media (scans / images / PDFs) in R2. Keys are server-generated
 * `<uuid>.<ext>` single path segments, so they are unguessable and the
 * router's one-segment :key param can address them.
 */
const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
const MAX_BYTES = 20 * 1024 * 1024;
const KEY_RE = /^[a-f0-9-]{36}\.(jpg|png|webp|gif|pdf)$/;

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/** POST /api/admin/media  (multipart/form-data, field "file") */
export async function upload(request, env) {
  const config = loadConfig(env);
  await requireAdmin(request, env);

  let form;
  try {
    form = await request.formData();
  } catch {
    throw fail("Expected multipart/form-data.", 400, "INVALID_INPUT");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw fail("file is required.", 400, "INVALID_INPUT");

  const ext = ALLOWED[file.type];
  if (!ext) throw fail("Only JPG, PNG, WebP, GIF or PDF files are allowed.", 415, "UNSUPPORTED_MEDIA");
  if (file.size > MAX_BYTES) throw fail("File is too large (max 20 MB).", 413, "FILE_TOO_LARGE");

  const key = `${crypto.randomUUID()}.${ext}`;
  await putObject(config.mediaBucket, key, await file.arrayBuffer(), { contentType: file.type });

  return jsonSuccess({ key, contentType: file.type, size: file.size }, { status: 201, allowedOrigin: config.allowedOrigin });
}

/** GET /api/public/media/:key */
export async function serve(request, env, ctx, params) {
  const config = loadConfig(env);
  if (!KEY_RE.test(params.key)) throw fail("Not found.", 404, "NOT_FOUND");

  const object = await getObject(config.mediaBucket, params.key);
  if (!object) throw fail("Not found.", 404, "NOT_FOUND");

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": config.allowedOrigin || "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
