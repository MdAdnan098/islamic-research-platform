import { SIZE_LADDER } from "./highlights.js";

/**
 * Geometry of the text-size slider. The stops are the sizes the editor already stores (SIZE_LADDER: 50 ... 300, normal = 100).
 * The track is split into two halves so that 100% is the exact centre: the stops below 100 are spread evenly over the left half,
 * the stops above 100 evenly over the right half. Positions are in permille (0 ... 1000) of the track width.
 */
export const SLIDER_STOPS = SIZE_LADDER;
export const SLIDER_MAX = 1000;
export const SLIDER_CENTER = SLIDER_STOPS.indexOf(100);

/** Position (permille) of the i-th stop. */
export function stopPos(i) {
  const n = SLIDER_STOPS.length;
  return i <= SLIDER_CENTER ? (500 * i) / SLIDER_CENTER : 500 + (500 * (i - SLIDER_CENTER)) / (n - 1 - SLIDER_CENTER);
}

/** Position (permille) of ANY percentage, interpolated between the neighbouring stops - used to place the H3 / H2 labels at their real size. */
export function valuePos(percent) {
  const v = Math.min(SLIDER_STOPS[SLIDER_STOPS.length - 1], Math.max(SLIDER_STOPS[0], percent));
  let i = SLIDER_STOPS.findIndex((s) => s >= v);
  if (i <= 0) return stopPos(0);
  const a = SLIDER_STOPS[i - 1], b = SLIDER_STOPS[i];
  return stopPos(i - 1) + ((v - a) / (b - a)) * (stopPos(i) - stopPos(i - 1));
}

/** The stop (a percentage) nearest to a track position. */
export function nearestStop(pos) {
  let best = SLIDER_STOPS[0], gap = Infinity;
  SLIDER_STOPS.forEach((s, i) => { const d = Math.abs(stopPos(i) - pos); if (d < gap) { gap = d; best = s; } });
  return best;
}

/**
 * The real sizes of the headings in a post, as a percentage of the surrounding body text. They are the em values of the heading
 * classes in components/article/BlockRenderer.jsx (H3: text-[1.25em] sm:text-[1.38em], H2: text-[1.45em] sm:text-[1.65em], H1: text-[1.75em] sm:text-[2.1em]);
 * `sm` is Tailwind's default 640px breakpoint. tests/sizeSlider.test.mjs checks these numbers against that file.
 */
export const HEADING_PERCENT = { narrow: { h3: 125, h2: 145, h1: 175 }, wide: { h3: 138, h2: 165, h1: 210 } };
export const WIDE_QUERY = "(min-width: 640px)";
export const headingPercents = (wide) => (wide ? HEADING_PERCENT.wide : HEADING_PERCENT.narrow);
