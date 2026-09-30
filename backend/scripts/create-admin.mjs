#!/usr/bin/env node
/**
 * One-time/offline admin bootstrap script.
 *
 * Runs OUTSIDE the Worker (plain Node.js) so it can prompt for a password
 * without ever putting it in source code, .dev.vars, or a Cloudflare
 * secret. It hashes the password with the exact same Web Crypto PBKDF2
 * algorithm the Worker uses (via Node's built-in `crypto.webcrypto`, so
 * the hash format is byte-for-byte compatible with backend/src/utils/password.js)
 * and upserts the resulting document directly into the `admins` collection.
 *
 * The plaintext password is never logged, written to a file, or sent
 * anywhere other than the one-time PBKDF2 derivation below.
 *
 * Usage:
 *   cd backend
 *   cp .dev.vars.example .dev.vars   # if not already done; fill in MONGODB_URI/MONGODB_DB_NAME
 *   npm run create:admin
 *   # follow the interactive prompts (email, password — input is hidden)
 *
 * Non-interactive alternative (e.g. CI), password supplied only via env var
 * for that single process invocation, never written to disk:
 *   MONGODB_URI=... MONGODB_DB_NAME=... \
 *   ADMIN_BOOTSTRAP_EMAIL=admin@example.com \
 *   ADMIN_BOOTSTRAP_PASSWORD='<entered manually in your shell, not saved>' \
 *   node scripts/create-admin.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { webcrypto } from "node:crypto";
import { MongoClient } from "mongodb";

const { subtle, getRandomValues } = webcrypto;
const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

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

function bufferToBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

async function hashPassword(password) {
  const salt = getRandomValues(new Uint8Array(16));
  const keyMaterial = await subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufferToBase64(salt)}$${bufferToBase64(bits)}`;
}

/** Prompts on the TTY without echoing the typed characters. */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const output = process.stdout;
    let muted = false;

    // eslint-disable-next-line no-underscore-dangle
    rl._writeToOutput = (str) => {
      if (!muted) output.write(str);
    };

    output.write(question);
    muted = true;
    rl.question("", (answer) => {
      muted = false;
      output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

function promptPlain(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
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

  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || (await promptPlain("Admin email: "))).trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("A valid email is required.");
    process.exit(1);
  }

  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || (await promptHidden("Admin password (hidden): "));
  if (!password || password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }

  console.log(`Hashing password and upserting admin "${email}"...`);
  const passwordHash = await hashPassword(password);

  const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("admins");

    await collection.createIndex({ email: 1 }, { unique: true });

    const now = new Date();
    await collection.updateOne(
      { email },
      {
        $set: { passwordHash, role: "admin", active: true, updatedAt: now },
        $setOnInsert: { email, createdAt: now },
      },
      { upsert: true }
    );

    console.log(`Done. Admin "${email}" is ready to log in. (Password was not stored anywhere but the hash.)`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to create/update admin:", err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
