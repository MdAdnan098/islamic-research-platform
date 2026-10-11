#!/usr/bin/env node
/**
 * One-off, idempotent: fills the derived search fields (searchTitle / searchText) on articles saved before
 * public search existed. It only ADDS those two fields - article content is never modified or removed.
 * Safe to re-run: only articles that still lack the fields are touched. New and edited articles keep the
 * fields up to date automatically.
 *
 * Usage:
 *   cd backend
 *   npm run backfill:search
 */
import { readFileSync, existsSync } from "node:fs";
import { loadConfig } from "../src/config/env.js";
import { backfillSearchFields } from "../src/services/db/article.service.js";

function loadDevVars() {
  const path = new URL("../.dev.vars", import.meta.url);
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
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
  let config;
  try {
    config = loadConfig({
      MONGODB_URI: process.env.MONGODB_URI || fileVars.MONGODB_URI,
      MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || fileVars.MONGODB_DB_NAME,
      ENVIRONMENT: process.env.ENVIRONMENT || fileVars.ENVIRONMENT,
      ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || fileVars.ALLOWED_ORIGIN,
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  let total = 0;
  for (;;) {
    const n = await backfillSearchFields(config, { limit: 200 });
    total += n;
    if (n < 200) break;
  }
  console.log(`OK   — search fields filled for ${total} article(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL —", err.message);
  process.exit(1);
});
