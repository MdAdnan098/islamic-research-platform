#!/usr/bin/env node
/**
 * Explicit, idempotent index bootstrap for the content collections.
 *
 * Deliberately NOT run automatically on any HTTP request — indexes are
 * created once, on purpose, by running this script. Safe to re-run any
 * number of times (createIndex is idempotent: MongoDB no-ops if an
 * identical index already exists).
 *
 * Reuses the same config loader / connection service the Worker uses
 * (src/config/env.js + src/services/db/mongo.service.js) rather than a
 * third reimplementation of the Mongo connection, so index definitions
 * never drift from what the running Worker actually expects.
 *
 * Usage:
 *   cd backend
 *   cp .dev.vars.example .dev.vars   # if not already done
 *   npm run bootstrap:indexes
 */
import { readFileSync, existsSync } from "node:fs";
import { loadConfig } from "../src/config/env.js";
import { ensureAdminIndexes } from "../src/services/db/admin.service.js";
import { ensureCategoryIndexes } from "../src/services/db/category.service.js";
import { ensureTopicIndexes } from "../src/services/db/topic.service.js";
import { ensureArticleIndexes } from "../src/services/db/article.service.js";
import { ensureReferenceIndexes } from "../src/services/db/reference.service.js";

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
  const fakeEnv = {
    MONGODB_URI: process.env.MONGODB_URI || fileVars.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || fileVars.MONGODB_DB_NAME,
    ENVIRONMENT: process.env.ENVIRONMENT || fileVars.ENVIRONMENT,
    ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || fileVars.ALLOWED_ORIGIN,
  };

  let config;
  try {
    config = loadConfig(fakeEnv);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const steps = [
    ["admins", ensureAdminIndexes],
    ["categories", ensureCategoryIndexes],
    ["topics", ensureTopicIndexes],
    ["articles", ensureArticleIndexes],
    ["references", ensureReferenceIndexes],
  ];

  for (const [name, ensureFn] of steps) {
    try {
      await ensureFn(config);
      console.log(`OK   — ${name} indexes ensured`);
    } catch (err) {
      console.error(`FAIL — ${name} indexes:`, err.message);
      process.exitCode = 1;
    }
  }

  // mongo.service.js caches the client at module scope; exit explicitly
  // rather than waiting on an open handle.
  process.exit(process.exitCode || 0);
}

main();
