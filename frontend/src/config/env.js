/**
 * Centralized access to Vite environment variables.
 * Import from here instead of using import.meta.env directly,
 * so env handling stays in one place as more variables are added.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8787",
};
