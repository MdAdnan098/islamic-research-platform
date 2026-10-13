// Run: cd frontend && node --test tests/*.test.mjs
import { fitWithin, pickQuality, MAX_SIDE, MIN_BYTES } from "../src/lib/compressImage.js";
import assert from "node:assert/strict";
import test from "node:test";

test("fitWithin caps the longest side and keeps the ratio", () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: MAX_SIDE, height: Math.round(3000 * MAX_SIDE / 4000) });
  assert.deepEqual(fitWithin(3000, 4000), { width: Math.round(3000 * MAX_SIDE / 4000), height: MAX_SIDE });
  assert.deepEqual(fitWithin(1200, 800), { width: 1200, height: 800 }); // never scales up
});

test("pickQuality raises quality until the size floor is reached", async () => {
  const sizes = { 0.85: 300e3, 0.9: 380e3, 0.94: 450e3, 0.97: 700e3 };
  assert.equal(await pickQuality(async (q) => sizes[q]), 0.94);
  assert.equal(await pickQuality(async () => 900e3), 0.85);           // big enough at once
  assert.equal(await pickQuality(async () => 100e3), 0.97);           // never reaches the floor -> best quality
  assert.equal(MIN_BYTES, 400 * 1024);
});
