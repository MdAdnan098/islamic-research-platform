import { ObjectId } from "mongodb";
import { getDb } from "./mongo.service.js";

/**
 * Data access for the `admins` collection. Kept separate from the
 * `articles` collection and from mongo.service.js's connection logic —
 * this file only knows about admin documents.
 *
 * Document shape:
 *   { _id, email, passwordHash, role, active, createdAt, updatedAt, lastLoginAt }
 */

const COLLECTION = "admins";

async function getAdminsCollection(config) {
  const db = await getDb(config);
  return db.collection(COLLECTION);
}

/**
 * Creates the unique index on email if it doesn't already exist.
 * Safe to call repeatedly (createIndex is idempotent).
 */
export async function ensureAdminIndexes(config) {
  const collection = await getAdminsCollection(config);
  await collection.createIndex({ email: 1 }, { unique: true });
}

export async function findAdminByEmail(config, email) {
  const collection = await getAdminsCollection(config);
  return collection.findOne({ email: email.trim().toLowerCase() });
}

export async function findAdminById(config, id) {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getAdminsCollection(config);
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function touchLastLogin(config, id) {
  const collection = await getAdminsCollection(config);
  await collection.updateOne({ _id: new ObjectId(id) }, { $set: { lastLoginAt: new Date() } });
}

/**
 * Used only by the offline bootstrap script (backend/scripts/create-admin.mjs),
 * never by any HTTP route.
 */
export async function upsertAdmin(config, { email, passwordHash, role = "admin" }) {
  const collection = await getAdminsCollection(config);
  const now = new Date();
  const normalizedEmail = email.trim().toLowerCase();

  await collection.updateOne(
    { email: normalizedEmail },
    {
      $set: { passwordHash, role, active: true, updatedAt: now },
      $setOnInsert: { email: normalizedEmail, createdAt: now },
    },
    { upsert: true }
  );

  return collection.findOne({ email: normalizedEmail });
}

/** Strips sensitive/internal fields before an admin doc is ever sent in a response. */
export function toSafeAdmin(admin) {
  if (!admin) return null;
  return {
    id: String(admin._id),
    email: admin.email,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt || null,
  };
}
