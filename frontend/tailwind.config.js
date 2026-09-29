/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Lora", "Georgia", "serif"],
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at top right, rgba(16,185,129,0.12), transparent 55%), radial-gradient(circle at bottom left, rgba(15,23,42,0.06), transparent 45%)",
      },
    },
  },
  plugins: [],
};
