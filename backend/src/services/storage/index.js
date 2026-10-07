import { putObject, getObject } from "./r2.service.js";
import { uploadToImageKit, imagekitUrl } from "./imagekit.service.js";

/**
 * Media provider selector (MEDIA_PROVIDER = "r2" | "imagekit", default "r2").
 *
 * Every provider exposes the same two operations, keyed by the provider-neutral
 * `<uuid>.<ext>` key that is stored in MongoDB:
 *   put(key, data, { contentType })      -> stores the file
 *   serve(key, config)                   -> Response for GET /api/public/media/:key, or null if missing
 */

/**
 * Legacy fallback: files uploaded while MEDIA_PROVIDER was "imagekit" are not in
 * the R2 bucket. If ImageKit is still configured (IMAGEKIT_URL_ENDPOINT), redirect
 * those keys to ImageKit so already-stored media keeps working without touching
 * MongoDB. Returns null (-> 404) when ImageKit is not configured.
 */
function legacyImageKitRedirect(key, config) {
  if (!config.imagekit?.urlEndpoint) return null;
  return new Response(null, {
    status: 302,
    headers: {
      Location: imagekitUrl(config.imagekit, key),
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": config.allowedOrigin || "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}

function r2Provider(config) {
  return {
    name: "r2",
    put: (key, data, options) => putObject(config.mediaBucket, key, data, options),
    // Stream the object from the bucket through the Worker (the bucket itself is never public).
    async serve(key) {
      const object = await getObject(config.mediaBucket, key);
      if (!object) return legacyImageKitRedirect(key, config);
      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": config.allowedOrigin || "*",
          "Cross-Origin-Resource-Policy": "cross-origin",
          "X-Content-Type-Options": "nosniff",
        },
      });
    },
  };
}

function imagekitProvider(config) {
  return {
    name: "imagekit",
    put: (key, data, options) => uploadToImageKit(config.imagekit, key, data, options),
    // Temporary: the file lives on ImageKit's CDN, so just redirect to it.
    async serve(key) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: imagekitUrl(config.imagekit, key),
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": config.allowedOrigin || "*",
          "Cross-Origin-Resource-Policy": "cross-origin",
        },
      });
    },
  };
}

const PROVIDERS = { r2: r2Provider, imagekit: imagekitProvider };

export function getStorage(config) {
  const make = PROVIDERS[config.mediaProvider];
  if (!make) {
    const err = new Error(`Unknown MEDIA_PROVIDER "${config.mediaProvider}". Use "r2" or "imagekit".`);
    err.status = 500;
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }
  return make(config);
}
