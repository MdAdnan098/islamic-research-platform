/**
 * Thin wrapper around the R2 bucket binding (MEDIA_BUCKET) for storing
 * scanned reference pages, images and PDFs.
 *
 * Kept minimal in this phase — just enough for later features (image/PDF
 * blocks, scanned reference pages) to build on without redesigning storage
 * access.
 */

/**
 * @param {R2Bucket} bucket
 * @param {string} key
 * @param {ReadableStream|ArrayBuffer|Blob} data
 * @param {{ contentType?: string }} [options]
 */
export async function putObject(bucket, key, data, options = {}) {
  if (!bucket) {
    const err = new Error("R2 bucket binding (MEDIA_BUCKET) is not configured.");
    err.status = 500;
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }

  return bucket.put(key, data, {
    httpMetadata: options.contentType ? { contentType: options.contentType } : undefined,
  });
}

/**
 * @param {R2Bucket} bucket
 * @param {string} key
 */
export async function getObject(bucket, key) {
  if (!bucket) {
    const err = new Error("R2 bucket binding (MEDIA_BUCKET) is not configured.");
    err.status = 500;
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }

  return bucket.get(key);
}

/**
 * @param {R2Bucket} bucket
 * @param {string} key
 */
export async function deleteObject(bucket, key) {
  if (!bucket) {
    const err = new Error("R2 bucket binding (MEDIA_BUCKET) is not configured.");
    err.status = 500;
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }

  return bucket.delete(key);
}
