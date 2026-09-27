#!/usr/bin/env node
/**
 * Standalone MongoDB Atlas connectivity check.
 *
 * This is NOT part of the Worker runtime — it uses the same `mongodb`
 * driver dependency already in package.json (no new dependency) but runs
 * under plain Node.js so it can be executed from any machine with real
 * network access to Atlas, including environments (like sandboxed CI/dev
 * containers) where the Worker's own /health endpoint can't be exercised
 * against the live cluster.
 *
 * Usage:
 *   cp .dev.vars.example .dev.vars   # fill in MONGODB_URI / MONGODB_DB_NAME
 *   npm run verify:db
 *
 * Exits 0 and prints the real `ping` command result on success,
 * exits 1 with the underlying driver error on failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { MongoClient } from "mongodb";

function loadDevVars() {
  const path = new URL("../.dev.vars", import.meta.url);
  if (!existsSync(path)) return {};

  const contents = readFileSync(path, "utf8");
  const vars = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return vars;
}

async function main() {
  const fileVars = loadDevVars();
  const uri = process.env.MONGODB_URI || fileVars.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || fileVars.MONGODB_DB_NAME;

  if (!uri || !dbName) {
    console.error(
      "Missing MONGODB_URI / MONGODB_DB_NAME.\n" +
        "Set them in backend/.dev.vars (see .dev.vars.example) or as environment variables."
    );
    process.exit(1);
  }

  console.log(`Connecting to MongoDB Atlas (database: "${dbName}")...`);
  const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });

  const start = Date.now();
  try {
    await client.connect();
    const db = client.db(dbName);
    const result = await db.command({ ping: 1 });
    const ms = Date.now() - start;

    console.log(`Ping succeeded in ${ms}ms:`, result);

    const collections = await db.listCollections().toArray();
    console.log(
      collections.length === 0
        ? "Database is empty (no collections) — as expected for this phase."
        : `Warning: database already has ${collections.length} collection(s): ${collections
            .map((c) => c.name)
            .join(", ")}`
    );

    process.exit(0);
  } catch (err) {
    console.error("Ping FAILED:", err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
