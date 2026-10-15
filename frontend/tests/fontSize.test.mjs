import test from "node:test";
import assert from "node:assert/strict";
import {
  clampScale,
  readStoredScale,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
  FONT_SCALE_DEFAULT,
  FONT_SCALE_PRESETS,
} from "../src/lib/fontSize.js";

test("clampScale: bounds font scale between FONT_SCALE_MIN and FONT_SCALE_MAX", () => {
  assert.equal(clampScale(1.0), 1.0);
  assert.equal(clampScale(0.5), FONT_SCALE_MIN);
  assert.equal(clampScale(0.79), FONT_SCALE_MIN);
  assert.equal(clampScale(0.8), 0.8);
  assert.equal(clampScale(1.5), 1.5);
  assert.equal(clampScale(1.51), FONT_SCALE_MAX);
  assert.equal(clampScale(2.5), FONT_SCALE_MAX);
  assert.equal(clampScale("invalid"), FONT_SCALE_DEFAULT);
  assert.equal(clampScale(null), FONT_SCALE_DEFAULT);
  assert.equal(clampScale(undefined), FONT_SCALE_DEFAULT);
});

test("clampScale: rounds to 2 decimal places properly", () => {
  assert.equal(clampScale(1.1000000000000003), 1.1);
  assert.equal(clampScale(1.2999999999999998), 1.3);
});

test("presets: all defined presets are strictly within valid bounds and sorted", () => {
  assert.ok(FONT_SCALE_PRESETS.length >= 3);
  let prev = 0;
  for (const p of FONT_SCALE_PRESETS) {
    assert.ok(p.scale >= FONT_SCALE_MIN, `Preset ${p.scale} should be >= ${FONT_SCALE_MIN}`);
    assert.ok(p.scale <= FONT_SCALE_MAX, `Preset ${p.scale} should be <= ${FONT_SCALE_MAX}`);
    assert.ok(p.scale > prev, "Presets should be sorted strictly ascending");
    prev = p.scale;
  }
  // Ensure default scale is in the presets
  const hasDefault = FONT_SCALE_PRESETS.some((p) => Math.abs(p.scale - FONT_SCALE_DEFAULT) < 0.01);
  assert.ok(hasDefault, "Presets should include the default scale (1.0)");
});

test("readStoredScale: reads from global localStorage when present and valid", () => {
  // Mock localStorage
  const originalLocalStorage = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
  };

  try {
    // Missing: returns default
    assert.equal(readStoredScale(), FONT_SCALE_DEFAULT);

    // Valid: returns parsed number
    globalThis.localStorage.setItem("fs_font_scale", "1.2");
    assert.equal(readStoredScale(), 1.2);

    // Below min: returns default
    globalThis.localStorage.setItem("fs_font_scale", "0.3");
    assert.equal(readStoredScale(), FONT_SCALE_DEFAULT);

    // Above max: returns default
    globalThis.localStorage.setItem("fs_font_scale", "3.0");
    assert.equal(readStoredScale(), FONT_SCALE_DEFAULT);

    // Non-numeric: returns default
    globalThis.localStorage.setItem("fs_font_scale", "huge");
    assert.equal(readStoredScale(), FONT_SCALE_DEFAULT);
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
});
