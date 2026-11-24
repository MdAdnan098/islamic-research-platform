import { getDb } from "./mongo.service.js";

/**
 * Data access for the `app_releases` collection: ONE document per platform describing the newest published
 * Android app (APK) release. Only the Android app exists today, so the single document has _id "android".
 *
 * Document shape:
 *   { _id: "android", latestVersion, minSupportedVersion|null, releaseDate: "YYYY-MM-DD"|null, releaseNotes: string[],
 *     downloadUrl, storeUrl, mandatory, published, updatedAt, updatedBy }
 *
 * This is deliberately separate from the website: the website needs no version, it updates on every deployment.
 */

const COLLECTION = "app_releases";
export const ANDROID_ID = "android";

async function getCollection(config) {
  const db = await getDb(config);
  return db.collection(COLLECTION);
}

export async function getAndroidRelease(config) {
  const c = await getCollection(config);
  return c.findOne({ _id: ANDROID_ID });
}

export async function saveAndroidRelease(config, value, adminUsername) {
  const c = await getCollection(config);
  const now = new Date();
  await c.updateOne(
    { _id: ANDROID_ID },
    { $set: { ...value, updatedAt: now, updatedBy: String(adminUsername || "").slice(0, 80) } },
    { upsert: true }
  );
  return c.findOne({ _id: ANDROID_ID });
}

/** Everything an admin needs to see/edit. */
export function toAdminRelease(doc) {
  if (!doc) return null;
  return {
    latestVersion: doc.latestVersion,
    minSupportedVersion: doc.minSupportedVersion || "",
    releaseDate: doc.releaseDate || "",
    releaseNotes: Array.isArray(doc.releaseNotes) ? doc.releaseNotes : [],
    downloadUrl: doc.downloadUrl || "",
    storeUrl: doc.storeUrl || "",
    mandatory: doc.mandatory === true,
    published: doc.published === true,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    updatedBy: doc.updatedBy || "",
  };
}

/** What the public app may see: nothing when unpublished; never admin names or timestamps. */
export function toPublicRelease(doc) {
  if (!doc || doc.published !== true) return null;
  return {
    latestVersion: doc.latestVersion,
    minSupportedVersion: doc.minSupportedVersion || null,
    releaseDate: doc.releaseDate || null,
    releaseNotes: Array.isArray(doc.releaseNotes) ? doc.releaseNotes : [],
    downloadUrl: doc.downloadUrl || "",
    storeUrl: doc.storeUrl || "",
    mandatory: doc.mandatory === true,
  };
}
