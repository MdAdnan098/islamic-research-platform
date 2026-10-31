import { request, qs } from "../lib/api.js";

/** Small TTL cache — category/topic lists are read on almost every page. */
const cache = new Map();
function cached(key, ttl, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = loader().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** After an admin pins/unpins a folder the lists must show it at once, so for a short while list requests skip the browser's 30 s cache. */
let freshUntil = 0;
export const bustPublicLists = () => { freshUntil = Date.now() + 40_000; };
const listCache = () => (Date.now() < freshUntil ? "reload" : undefined);

export const SECTION_PATH = { aqeedah: "aqaid", masail: "masail" };
export const PATH_TYPE = { aqaid: "aqeedah", masail: "masail" };

export const publicApi = {
  home: (signal) => request("/api/public/home", { signal, cache: listCache() }),
  categories: (signal) => cached("categories", 60_000, () => request("/api/public/categories", { signal }).then((d) => d.categories)),
  topics: (categoryId, signal) =>
    cached(`topics:${categoryId}`, 60_000, () => request(`/api/public/topics${qs({ categoryId })}`, { signal }).then((d) => d.topics)),
  articles: (params, signal) => request(`/api/public/articles${qs(params)}`, { signal }).then((d) => d.articles),
  /** Paged listing: { articles, hasMore, page }. params: { type, general, topicId, page, limit } */
  articlePage: (params, signal) => request(`/api/public/articles${qs(params)}`, { signal }),
  /** Root folders (top level only): { folders, total, hasMore }. params: { type, page, limit } */
  folders: (params, signal) => request(`/api/public/folders${qs(params)}`, { signal, cache: listCache() }),
  folder: (type, slug, signal) => request(`/api/public/folders/by-slug${qs({ type, slug })}`, { signal }),
  /** One combined newest-first feed (any section / folder depth). { articles, hasMore, page } */
  latest: (params, signal) => request(`/api/public/latest${qs(params)}`, { signal }),
  search: (params, signal) => request(`/api/public/search${qs(params)}`, { signal }),
  article: (slug, signal) => request(`/api/public/articles/${encodeURIComponent(slug)}`, { signal }),

  liveSessions: (params, signal) => request(`/api/public/live-sessions${qs(params)}`, { signal }).then((d) => d.sessions),
  courses: (signal) => request("/api/public/courses", { signal }).then((d) => d.courses),
  course: (slug, signal) => request(`/api/public/courses/${encodeURIComponent(slug)}`, { signal }).then((d) => d.course),

  // Payment + enrollment. Prices/amounts are decided by the server; nothing here is trusted by it.
  createOrder: (courseId, body) => request(`/api/public/courses/${courseId}/payment/order`, { method: "POST", body }),
  courseAccess: (courseId, body, signal) => request(`/api/public/courses/${courseId}/access`, { method: "POST", body, signal }),
  verifyPayment: (body) => request("/api/public/payments/verify", { method: "POST", body }),
  paymentStatus: (body) => request("/api/public/payments/status", { method: "POST", body }),
  enroll: (courseId, body) => request(`/api/public/courses/${courseId}/enroll`, { method: "POST", body }),
};
