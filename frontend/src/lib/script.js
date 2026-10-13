/**
 * Script detection — lets one string of content pick the right font + direction
 * (Urdu Nastaliq vs Arabic Naskh vs Devanagari vs Latin) regardless of UI language.
 */
const URDU_ONLY = /[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06C3\u06D2\u06D3\u06CC\u06A9\u06AF\u0686\u067E\u0698]/;
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const DEVA = /[\u0900-\u097F]/;

export function scriptOf(text = "", force) {
  if (force) return force;
  const sample = String(text).slice(0, 240);
  let ar = 0, de = 0, la = 0;
  for (const ch of sample) {
    if (ARABIC.test(ch)) ar++;
    else if (DEVA.test(ch)) de++;
    else if (/[A-Za-z]/.test(ch)) la++;
  }
  if (!ar && !de && !la) return "latin";
  if (ar >= de && ar >= la) return URDU_ONLY.test(sample) ? "urdu" : "arabic";
  return de > la ? "deva" : "latin";
}

export const isRtl = (script) => script === "arabic" || script === "urdu";
export const scriptClass = (script) => `script-${script}`;

const LETTER = /[A-Za-z\u0900-\u097F\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Splits one paragraph into runs of consecutive LINES that share a script, so every run gets its own
 * direction and font. A pasted block like "Roman line / Arabic line / Roman line" then renders as
 * left-to-right, right-to-left, left-to-right instead of the whole block taking one direction
 * (which pushed the Roman lines to the right edge). Lines without letters (numbers, dashes, blanks)
 * stay with the run before them.
 *
 * Every run is an exact slice of `str`; `start` is its offset in the full block text (`base` + offset in
 * `str`), so highlight offsets keep working.
 */
export function splitScriptRuns(str, base = 0) {
  const text = String(str ?? "");
  const runs = [];
  let pos = 0;
  for (const line of text.split("\n")) {
    const a = pos;
    const b = pos + line.length;
    pos = b + 1;
    const script = LETTER.test(line) ? scriptOf(line) : null;
    const last = runs[runs.length - 1];
    if (!last) runs.push({ a, b, script });
    else if (script === null || last.script === null || script === last.script) {
      last.b = b;
      if (last.script === null) last.script = script;
    } else runs.push({ a, b, script });
  }
  return runs
    .map((r) => ({ text: text.slice(r.a, r.b), start: base + r.a, script: r.script || "latin" }))
    .filter((r) => r.text.trim().length > 0);
}
