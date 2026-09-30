import { env } from "../config/env.js";

/**
 * Minimal fetch wrapper for talking to the Worker API.
 * Keeps base URL, JSON parsing, and error handling in one place.
 */
async function request(path, options = {}) {
  const url = `${env.apiBaseUrl}${path}`;

  let response;
  try {
    response = await fetch(url, {
      // Needed so the admin session (HttpOnly) cookie is sent/received
      // cross-origin between the Vite dev server and the Worker.
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch (networkError) {
    throw new Error(`Network error while calling ${path}: ${networkError.message}`);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message = body?.error?.message || `Request to ${path} failed with status ${response.status}`;
    const err = new Error(message);
    err.code = body?.error?.code || null;
    err.status = response.status;
    throw err;
  }

  return body;
}

export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: "PUT", body: JSON.stringify(data) }),
  del: (path) => request(path, { method: "DELETE" }),
};
