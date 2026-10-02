const c = (n) => `rgb(var(--${n}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Public "research library" palette
        paper: c("paper"), card: c("card"), ink: c("ink"), mute: c("mute"),
        rule: c("rule"), gold: c("gold"), bronze: c("bronze"), navy: c("navy"),
        // Admin palette (separate visual system)
        "ad-bg": c("ad-bg"), "ad-card": c("ad-card"), "ad-ink": c("ad-ink"),
        "ad-mute": c("ad-mute"), "ad-rule": c("ad-rule"), "ad-brand": c("ad-brand"),
        "ad-danger": c("ad-danger"), "ad-ok": c("ad-ok"), "ad-warn": c("ad-warn"),
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        ui: ["Inter", "system-ui", "sans-serif"],
        arabic: ["Amiri", "'Noto Naskh Arabic'", "serif"],
        urdu: ["'Noto Nastaliq Urdu'", "serif"],
      },
      boxShadow: { soft: "0 1px 2px rgb(0 0 0 / .04), 0 8px 24px -12px rgb(0 0 0 / .12)" },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: { "fade-up": "fade-up .5s ease-out both", fade: "fade .25s ease-out both" },
    },
  },
  plugins: [],
};
