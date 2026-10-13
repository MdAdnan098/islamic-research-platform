// Run: cd frontend && node --test tests/*.test.mjs
import { fitWithin, pickQuality, MAX_SIDE, TARGET_BYTES, MIN_QUALITY, MAX_QUALITY } from "../src/lib/compressImage.js";
import assert from "node:assert/strict";
import test from "node:test";

test("fitWithin caps the longest side and keeps the ratio", () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: MAX_SIDE, height: Math.round(3000 * MAX_SIDE / 4000) });
  assert.deepEqual(fitWithin(3000, 4000), { width: Math.round(3000 * MAX_SIDE / 4000), height: MAX_SIDE });
  assert.deepEqual(fitWithin(1200, 800), { width: 1200, height: 800 }); // never scales up
});

test("pickQuality: highest quality that fits the target, never below the minimum quality", async () => {
  const linear = (q) => 1000e3 * q; // size grows with quality; 400 KB (409600) is reached at q = 0.4096
  assert.equal(await pickQuality(async () => 100e3), MAX_QUALITY);            // small anyway -> best quality
  assert.equal(await pickQuality(async () => 900e3), MIN_QUALITY);            // too dense -> protect quality, stay bigger
  const q = await pickQuality(async (x) => 700e3 * x * 1.0);                  // 700KB*q <= 409600 -> q <= 0.585, below the min
  assert.equal(q, MIN_QUALITY);
  const mid = await pickQuality(async (x) => 520e3 * x);                      // fits up to q = 0.7877 -> between min and max
  assert.ok(mid > 0.78 && mid <= 0.7877 + 1e-9, String(mid));
  assert.ok(linear(MIN_QUALITY) > 0 && TARGET_BYTES === 400 * 1024);
});
