/**
 * Dynamic desert-and-mosque banner: sky colours follow the visitor's local clock.
 * Pure functions only (no React) so the whole look can be tested on its own.
 *
 *   skyAt(hour)      -> every colour / position for that hour (0-24, decimals allowed)
 *   sceneSvg(sky)    -> the SVG markup (stars, sun, moon, dunes, mosque)
 *   skyGradient(sky) -> CSS background for the banner
 *   hourOf(date)     -> local hour as a decimal, e.g. 17:30 -> 17.5
 *
 * To change the look at a given time, edit the matching row in STOPS below.
 */

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
const smooth = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * One row per moment of the day.
 *   h     hour (24h clock)           top / mid / bot  sky, top to bottom
 *   d1/d2 front / back sand dune     mq  mosque silhouette      stars  0..1 (night sky)
 */
const STOPS = [
  { h: 0,    top: "#0a1233", mid: "#12204f", bot: "#1f3470", d1: "#0f1a48", d2: "#1a2a62", mq: "#08102f", stars: 1 },     // deep night, moonlight blue
  { h: 4.5,  top: "#0f1a46", mid: "#263468", bot: "#51457f", d1: "#1c2354", d2: "#2a2f68", mq: "#10163c", stars: 0.85 },  // before dawn
  { h: 5.5,  top: "#3a3f86", mid: "#a65f8c", bot: "#f0966f", d1: "#5a4577", d2: "#7d5a8c", mq: "#2d2354", stars: 0.2 },   // first red light (lali)
  { h: 6.5,  top: "#9aa9d8", mid: "#f6b58b", bot: "#ffd58f", d1: "#bd8596", d2: "#d79fa0", mq: "#6b4a6e", stars: 0 },     // sunrise
  { h: 7.6,  top: "#f9cfa6", mid: "#fde4ab", bot: "#ffefbf", d1: "#dfa9bd", d2: "#ebbcc0", mq: "#c490ad", stars: 0 },     // yellow day
  { h: 15.8, top: "#f9cfa6", mid: "#fde4ab", bot: "#ffefbf", d1: "#dfa9bd", d2: "#ebbcc0", mq: "#c490ad", stars: 0 },     // day holds
  { h: 17.0, top: "#f6bf8f", mid: "#fbd599", bot: "#ffe3a5", d1: "#d99aa6", d2: "#e5aaa4", mq: "#b57a96", stars: 0 },     // late afternoon
  { h: 17.9, top: "#6a5aa0", mid: "#e5677c", bot: "#ffab5f", d1: "#8e4f78", d2: "#b3607a", mq: "#4a2a5c", stars: 0 },     // sunset: red, orange, violet
  { h: 18.6, top: "#2d2f73", mid: "#8c4a8c", bot: "#e0745f", d1: "#3b2f66", d2: "#5d3d7a", mq: "#231a4a", stars: 0.3 },   // dusk
  { h: 19.4, top: "#141d52", mid: "#2a3070", bot: "#4a3f7c", d1: "#1a2158", d2: "#272d68", mq: "#0f1538", stars: 0.85 },  // evening
  { h: 20.5, top: "#0a1233", mid: "#12204f", bot: "#1f3470", d1: "#0f1a48", d2: "#1a2a62", mq: "#08102f", stars: 1 },     // night
  { h: 24,   top: "#0a1233", mid: "#12204f", bot: "#1f3470", d1: "#0f1a48", d2: "#1a2a62", mq: "#08102f", stars: 1 },
].map((s) => ({ ...s, top: rgb(s.top), mid: rgb(s.mid), bot: rgb(s.bot), d1: rgb(s.d1), d2: rgb(s.d2), mq: rgb(s.mq) }));

export function hourOf(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

const luma = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

export function skyAt(hourIn) {
  const hour = ((hourIn % 24) + 24) % 24;
  let i = 0;
  while (i < STOPS.length - 2 && hour >= STOPS[i + 1].h) i++;
  const a = STOPS[i], b = STOPS[i + 1];
  const f = smooth((hour - a.h) / (b.h - a.h));
  const m = (k) => mix(a[k], b[k], f);
  const top = m("top"), mid = m("mid"), bot = m("bot");
  const stars = a.stars + (b.stars - a.stars) * f;

  // Sun: up 6:00 -> 18:00, low = deep orange, high = pale gold. Drawn behind the dunes, so it rises out of the sand.
  const sf = clamp01((hour - 6) / 12);
  const sunAlpha = smooth((hour - 5.7) / 0.7) * smooth((18.5 - hour) / 0.7);
  const arc = Math.sin(Math.PI * sf);
  const sun = { a: sunAlpha, x: 45 + 310 * sf, y: 152 - 62 * arc, col: toHex(mix(rgb("#ff8a45"), rgb("#fff4b8"), Math.min(1, arc * 1.6))) };

  // Moon: up 18:00 -> 06:00, travels right to left.
  const mh = hour >= 18 ? hour - 18 : hour + 6;
  const mf = clamp01(mh / 12);
  const moonAlpha = smooth((mh + 0.2) / 0.8) * smooth((12.4 - mh) / 0.8);
  const moon = { a: moonAlpha, x: 345 - 290 * mf, y: 150 - 52 * Math.sin(Math.PI * mf) };

  const dark = luma(mix(top, mid, 0.5)) < 0.5; // light text on dark sky, dark text on light sky
  return {
    top: toHex(top), mid: toHex(mid), bot: toHex(bot), d1: toHex(m("d1")), d2: toHex(m("d2")), mq: toHex(m("mq")),
    stars, win: clamp01(stars * 1.1 + (1 - luma(bot)) * 0.25 - 0.1), sun, moon, dark,
    text: dark ? "#fff6e4" : "#3a2a1f", shadow: dark ? "0 1px 8px rgb(0 0 0 / .45)" : "0 1px 0 rgb(255 255 255 / .35)",
  };
}

export const skyGradient = (s) => `linear-gradient(172deg, ${s.top} 0%, ${s.mid} 52%, ${s.bot} 100%)`;

// Fixed star positions (x, y, radius, twinkle delay) in the 400x200 scene.
const STARS = [[12,22,1,0],[38,64,.8,.6],[57,18,1.1,1.2],[74,92,.7,.3],[96,40,1,.9],[118,12,.8,1.6],[134,70,.9,.2],[152,34,1.2,1.1],[171,88,.7,.7],[190,16,.9,1.4],[214,52,1,.4],[236,24,.8,1],[251,84,1.1,.1],[268,38,.9,1.7],[287,14,1,.5],[301,72,.8,1.3],[322,30,1.2,.8],[339,90,.7,.2],[356,46,1,1.5],[377,20,.9,.9],[390,66,.8,.6],[24,104,.7,1.1],[88,118,.8,.4],[262,110,.7,1.8],[330,112,.9,.3],[198,100,.7,.9],[46,38,.6,1.2],[310,52,.6,.1]];

/** SVG scene, viewBox 400x200. Meant to sit at the bottom of the banner with preserveAspectRatio="xMidYMax slice". */
export function sceneSvg(s) {
  const stars = STARS.map(([x, y, r, d]) => `<circle class="sky-star" cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${(s.stars * 0.9).toFixed(2)}" style="animation-delay:${d}s"/>`).join("");
  const sun = s.sun.a > 0.01
    ? `<g opacity="${s.sun.a.toFixed(2)}"><circle cx="${s.sun.x.toFixed(1)}" cy="${s.sun.y.toFixed(1)}" r="34" fill="url(#skySunGlow)"/><circle cx="${s.sun.x.toFixed(1)}" cy="${s.sun.y.toFixed(1)}" r="13" fill="${s.sun.col}"/></g>` : "";
  const mx = s.moon.x.toFixed(1), my = s.moon.y.toFixed(1);
  const moon = s.moon.a > 0.01
    ? `<g opacity="${s.moon.a.toFixed(2)}"><circle cx="${mx}" cy="${my}" r="26" fill="#cfe0ff" opacity=".12"/><circle cx="${mx}" cy="${my}" r="13" fill="#fff4cf" mask="url(#skyMoonCut)"/></g>` : "";
  const win = s.win.toFixed(2);
  const lit = (x, w) => `<path d="M${x} 176 v-12 a${w / 2} ${w / 2} 0 0 1 ${w} 0 v12z" fill="#ffd36a" opacity="${win}"/>`;
  const minaret = (cx, w, top, base, balconies, tall) => {
    const half = w / 2;
    const bal = balconies.map((y) => `<rect x="${cx - half - 3}" y="${y}" width="${w + 6}" height="2.6" rx="1"/>`).join("");
    return `<rect x="${cx - half}" y="${top}" width="${w}" height="${base - top}"/>${bal}<path d="M${cx - half - 0.6} ${top} L${cx} ${top - tall} L${cx + half + 0.6} ${top}Z"/><rect x="${cx - 0.5}" y="${top - tall - 6}" width="1" height="6"/>`;
  };
  return `<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="position:absolute;inset:0;width:100%;height:100%">
<defs>
<radialGradient id="skySunGlow"><stop offset="0" stop-color="${s.sun.col}" stop-opacity=".55"/><stop offset="1" stop-color="${s.sun.col}" stop-opacity="0"/></radialGradient>
<mask id="skyMoonCut"><rect x="0" y="0" width="400" height="200" fill="#fff"/><circle cx="${(s.moon.x + 6).toFixed(1)}" cy="${(s.moon.y - 3.5).toFixed(1)}" r="11" fill="#000"/></mask>
</defs>
${stars}${sun}${moon}
<path d="M0 156 C50 138 110 148 170 144 S300 128 400 146 L400 200 L0 200Z" fill="${s.d2}"/>
<g fill="${s.mq}">
<path d="M174 146 C174 124 226 124 226 146Z"/>
<rect x="176" y="141" width="48" height="8"/>
<rect x="199.2" y="115" width="1.6" height="11"/>
<circle cx="200" cy="113" r="2.6"/>
<path d="M164 150 C164 136 184 136 184 150Z"/><path d="M216 150 C216 136 236 136 236 150Z"/>
<rect x="164" y="148" width="72" height="30"/>
${minaret(146, 7, 126, 178, [136, 146], 12)}
${minaret(254, 7, 126, 178, [136, 146], 12)}
${minaret(129, 5, 144, 178, [152], 9)}
${minaret(271, 5, 144, 178, [152], 9)}
</g>
${lit(174, 8)}${lit(196, 8)}${lit(218, 8)}
<path d="M0 178 C70 166 150 182 230 174 S350 166 400 176 L400 200 L0 200Z" fill="${s.d1}"/>
</svg>`;
}
