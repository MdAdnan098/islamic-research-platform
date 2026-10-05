const c = (n) => `rgb(var(--${n}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // script-* classes are built dynamically in lib/script.js, so Tailwind cannot see them
  safelist: ["script-arabic", "script-urdu", "script-deva", "script-latin"],
  theme: {
    extend: {
      colors: {
        // Public "research library" palette
        paper: c("paper"), card: c("card"), ink: c("ink"), mute: c("mute"),
        rule: c("rule"), accent: c("accent"), gold: c("gold"), bronze: c("bronze"), navy: c("navy"),
        "on-accent": c("on-accent"), tint: c("tint"), soft: c("soft"), hero: c("hero"), field: c("field"), footer: c("footer"), good: c("good"),
        // Admin palette (separate visual system)
        "ad-bg": c("ad-bg"), "ad-card": c("ad-card"), "ad-ink": c("ad-ink"),
        "ad-mute": c("ad-mute"), "ad-rule": c("ad-rule"), "ad-brand": c("ad-brand"),
        "ad-danger": c("ad-danger"), "ad-ok": c("ad-ok"), "ad-warn": c("ad-warn"),
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        ui: ["Figtree", "system-ui", "sans-serif"],
        arabic: ["'FS Arabic'", "'FS Quran'", "Amiri", "'Noto Naskh Arabic'", "serif"],
        urdu: ["'FS Urdu'", "'Noto Nastaliq Urdu'", "serif"],
      },
      boxShadow: { soft: "var(--shadow-soft)" },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: { "fade-up": "fade-up .5s ease-out both", fade: "fade .25s ease-out both" },
    },
  },
  plugins: [],
};
