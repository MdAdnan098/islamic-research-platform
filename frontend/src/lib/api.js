import { API_BASE } from "../config/env.js";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "ERROR" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
});

/** 502/503/504 = the server (or its database connection) was momentarily not ready; the request itself was fine. */
const TRANSIENT = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [1200, 2500];

/** Thin fetch wrapper around the backend's `{ success, data | error }` envelope. */
export async function request(path, { method = "GET", body, form, signal } = {}) {
  // Reads and sign-in are safe to repeat, so a momentary 503 / network blip is retried quietly instead of
  // showing "Request failed (503)". Other writes are never repeated automatically.
  // The draft auto-save and publish are safe to repeat (version-checked / idempotent), so they are retried too.
  const retryable = method === "GET" || path.endsWith("/api/admin/login") || (method === "PUT" && path.endsWith("/draft")) || path.endsWith("/publish");

  for (let attempt = 0; ; attempt += 1) {
    const last = attempt >= RETRY_DELAYS_MS.length || !retryable;
    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        signal,
        credentials: "include",
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      });
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      if (!last) { await sleep(RETRY_DELAYS_MS[attempt], signal); continue; }
      throw new ApiError("Server tak pahunch nahi paye. Internet / API URL check karein.", { code: "NETWORK" });
    }

    if (TRANSIENT.has(res.status) && !last) { await sleep(RETRY_DELAYS_MS[attempt], signal); continue; }

    let json = null;
    try { json = await res.json(); } catch { /* non-JSON body */ }

    if (!res.ok || !json?.success) {
      if (res.status === 401 && path.startsWith("/api/admin") && !path.endsWith("/login")) {
        window.dispatchEvent(new Event("fs:unauthorized"));
      }
      throw new ApiError(json?.error?.message || `Request failed (${res.status})`, {
        status: res.status,
        code: json?.error?.code || `HTTP_${res.status}`,
      });
    }
    return json.data;
  }
}

export const qs = (params = {}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && sp.set(k, v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};
