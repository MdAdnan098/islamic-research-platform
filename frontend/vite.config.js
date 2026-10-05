import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Keep function names in production so crash screens show real component names.
  esbuild: { keepNames: true },
  server: {
    port: 5173,
  },
});
