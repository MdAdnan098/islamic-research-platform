/**
 * Temporary media provider: ImageKit (https://imagekit.io).
 *
 * Used while no R2 bucket is available (MEDIA_PROVIDER=imagekit). Files are
 * uploaded server-side with the PRIVATE key (never sent to the browser) and
 * are addressed by the same provider-neutral `<uuid>.<ext>` key that R2 uses,
 * so MongoDB, the frontend and the public `/api/public/media/:key` route stay
 * identical and switching back to R2 is just MEDIA_PROVIDER=r2.
 */

const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

function notConfigured(name) {
  const err = new Error(`ImageKit is not configured: set ${name}.`);
  err.status = 500;
  err.code = "STORAGE_NOT_CONFIGURED";
  return err;
}

/** "/fahm-e-salaf/" | "fahm-e-salaf" -> "/fahm-e-salaf" */
function normalizeFolder(folder) {
  const clean = String(folder || "").trim().replace(/^\/+|\/+$/g, "");
  return clean ? `/${clean}` : "";
}

/** Public ImageKit URL of a stored key. */
export function imagekitUrl(imagekit, key) {
  if (!imagekit?.urlEndpoint) throw notConfigured("IMAGEKIT_URL_ENDPOINT");
  const base = imagekit.urlEndpoint.replace(/\/+$/, "");
  return `${base}${normalizeFolder(imagekit.folder)}/${encodeURIComponent(key)}`;
}

/**
 * Uploads a file to ImageKit under the given key (exact file name, no random suffix).
 * @param {{ privateKey?: string, urlEndpoint?: string, folder?: string }} imagekit
 * @param {string} key
 * @param {ArrayBuffer} data
 * @param {{ contentType?: string }} [options]
 */
export async function uploadToImageKit(imagekit, key, data, options = {}) {
  if (!imagekit?.privateKey) throw notConfigured("IMAGEKIT_PRIVATE_KEY");

  const form = new FormData();
  form.append("file", new Blob([data], options.contentType ? { type: options.contentType } : undefined), key);
  form.append("fileName", key);
  form.append("folder", normalizeFolder(imagekit.folder) || "/");
  form.append("useUniqueFileName", "false");

  let res;
  try {
    res = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${imagekit.privateKey}:`)}` },
      body: form,
    });
  } catch {
    const err = new Error("Could not reach ImageKit.");
    err.status = 502;
    err.code = "MEDIA_UPLOAD_FAILED";
    throw err;
  }

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.message || ""; } catch { /* non-JSON error body */ }
    const err = new Error(`ImageKit upload failed (${res.status})${detail ? `: ${detail}` : ""}`);
    err.status = 502;
    err.code = "MEDIA_UPLOAD_FAILED";
    throw err;
  }
  return res.json();
}
