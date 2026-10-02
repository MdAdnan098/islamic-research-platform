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
