import { API_BASE } from "../config/env.js";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "ERROR" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Thin fetch wrapper around the backend's `{ success, data | error }` envelope. */
export async function request(path, { method = "GET", body, form, signal } = {}) {
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
    throw new ApiError("Server tak pahunch nahi paye. Internet / API URL check karein.", { code: "NETWORK" });
  }

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

export const qs = (params = {}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && sp.set(k, v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};
