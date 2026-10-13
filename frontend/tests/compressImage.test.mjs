// Run: cd frontend && node --test tests/*.test.mjs
import { fitWithin, MAX_SIDE } from "../src/lib/compressImage.js";
import assert from "node:assert/strict";
import test from "node:test";

test("fitWithin caps the longest side and keeps the ratio", () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: MAX_SIDE, height: Math.round(3000 * MAX_SIDE / 4000) });
  assert.deepEqual(fitWithin(3000, 4000), { width: Math.round(3000 * MAX_SIDE / 4000), height: MAX_SIDE });
  assert.deepEqual(fitWithin(1200, 800), { width: 1200, height: 800 }); // never scales up
});
