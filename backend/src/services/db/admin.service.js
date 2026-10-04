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
 * Idempotent. Usernames are unique; the legacy `email` index is replaced
 * by a partial one so admins created via the register page (no email)
 * don't collide on a missing/null email.
 */
export async function ensureAdminIndexes(config) {
  const collection = await getAdminsCollection(config);
  try { await collection.dropIndex("email_1"); } catch { /* already dropped / never existed */ }
  await collection.createIndex({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: "string" } } });
  await collection.createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
}

/** Matches `username`, or a legacy admin's `email` (so old accounts still sign in). */
export async function findAdminByUsername(config, username) {
  const collection = await getAdminsCollection(config);
  const u = username.trim().toLowerCase();
  return collection.findOne({ $or: [{ username: u }, { email: u }] });
}

export async function createAdmin(config, { username, passwordHash }) {
  const collection = await getAdminsCollection(config);
  const now = new Date();
  const doc = { username: username.trim().toLowerCase(), passwordHash, role: "admin", active: true, createdAt: now, updatedAt: now };
  await collection.insertOne(doc); // throws E11000 if the username is taken
  return doc;
}

export async function setAdminPassword(config, id, passwordHash) {
  const collection = await getAdminsCollection(config);
  await collection.updateOne({ _id: new ObjectId(id) }, { $set: { passwordHash, updatedAt: new Date() } });
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
    username: admin.username || admin.email,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt || null,
  };
}
