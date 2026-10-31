import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HEADING_PERCENT, SLIDER_CENTER, SLIDER_STOPS, headingPercents, nearestStop, stopPos, valuePos } from "../src/lib/sizeSlider.js";
import { SIZE_STEPS } from "../src/lib/highlights.js";

test("slider stops are exactly the stored text sizes, with 100% in the exact centre", () => {
  assert.deepEqual(SLIDER_STOPS, [...SIZE_STEPS.filter((p) => p < 100), 100, ...SIZE_STEPS.filter((p) => p > 100)]);
  assert.equal(SLIDER_STOPS[SLIDER_CENTER], 100);
  assert.equal(stopPos(SLIDER_CENTER), 500);
  assert.equal(stopPos(0), 0);
  assert.equal(stopPos(SLIDER_STOPS.length - 1), 1000);
  for (let i = 1; i < SLIDER_STOPS.length; i++) assert.ok(stopPos(i) > stopPos(i - 1), "positions increase to the right");
  assert.ok(valuePos(60) < valuePos(100) && valuePos(100) < valuePos(150)); // left = smaller, right = bigger
});

test("nearestStop snaps a dragged position to a defined stop and round-trips every stop", () => {
  SLIDER_STOPS.forEach((s, i) => { assert.equal(nearestStop(stopPos(i)), s); assert.equal(valuePos(s), stopPos(i)); });
  assert.equal(nearestStop(0), 50);
  assert.equal(nearestStop(1000), 300);
  assert.equal(nearestStop(499), 100);
});

test("H3 / H2 label positions come from the REAL heading sizes in BlockRenderer.jsx (not invented numbers)", () => {
  const src = readFileSync(new URL("../src/components/article/BlockRenderer.jsx", import.meta.url), "utf8");
  const em = (re) => { const m = re.exec(src); assert.ok(m, `pattern ${re} not found`); return [Math.round(parseFloat(m[1]) * 100), Math.round(parseFloat(m[2]) * 100)]; };
  const [h3n, h3w] = em(/level === 3[\s\S]*?text-\[([\d.]+)em\] sm:text-\[([\d.]+)em\] font-semibold/);
  const [h2n, h2w] = em(/<Text key=\{key\} as="h2" src=\{text\} \{\.\.\.attrs\} className="mb-4 mt-14[^"]*text-\[([\d.]+)em\] sm:text-\[([\d.]+)em\] font-semibold/);
  const [h1n, h1w] = em(/level === 1\) return <Text[^>]*?text-\[([\d.]+)em\] sm:text-\[([\d.]+)em\]/);
  assert.deepEqual(HEADING_PERCENT.narrow, { h3: h3n, h2: h2n, h1: h1n });
  assert.deepEqual(HEADING_PERCENT.wide, { h3: h3w, h2: h2w, h1: h1w });
  assert.ok(valuePos(HEADING_PERCENT.narrow.h2) < valuePos(HEADING_PERCENT.narrow.h1) && valuePos(HEADING_PERCENT.wide.h2) < valuePos(HEADING_PERCENT.wide.h1));
  assert.equal(valuePos(HEADING_PERCENT.narrow.h1), stopPos(SLIDER_STOPS.indexOf(175))); // H1 on phones is exactly the 175% stop
  assert.equal(headingPercents(false), HEADING_PERCENT.narrow);
  assert.equal(headingPercents(true), HEADING_PERCENT.wide);
  // on phones H3 sits exactly on the 125% stop; H2 lies between 125% and 150%, nearer 150%
  assert.equal(valuePos(HEADING_PERCENT.narrow.h3), stopPos(SLIDER_STOPS.indexOf(125)));
  assert.ok(valuePos(145) > stopPos(SLIDER_STOPS.indexOf(125)) && valuePos(145) < stopPos(SLIDER_STOPS.indexOf(150)));
  assert.ok(valuePos(HEADING_PERCENT.wide.h3) < valuePos(HEADING_PERCENT.wide.h2));
});
