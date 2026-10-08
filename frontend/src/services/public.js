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

export const SECTION_PATH = { aqeedah: "aqaid", masail: "masail" };
export const PATH_TYPE = { aqaid: "aqeedah", masail: "masail" };

export const publicApi = {
  home: (signal) => request("/api/public/home", { signal }),
  categories: (signal) => cached("categories", 60_000, () => request("/api/public/categories", { signal }).then((d) => d.categories)),
  topics: (categoryId, signal) =>
    cached(`topics:${categoryId}`, 60_000, () => request(`/api/public/topics${qs({ categoryId })}`, { signal }).then((d) => d.topics)),
  articles: (params, signal) => request(`/api/public/articles${qs(params)}`, { signal }).then((d) => d.articles),
  article: (slug, signal) => request(`/api/public/articles/${encodeURIComponent(slug)}`, { signal }),

  liveSessions: (params, signal) => request(`/api/public/live-sessions${qs(params)}`, { signal }).then((d) => d.sessions),
  courses: (signal) => request("/api/public/courses", { signal }).then((d) => d.courses),
  course: (slug, signal) => request(`/api/public/courses/${encodeURIComponent(slug)}`, { signal }).then((d) => d.course),

  // Payment + enrollment. Prices/amounts are decided by the server; nothing here is trusted by it.
  createOrder: (courseId) => request(`/api/public/courses/${courseId}/payment/order`, { method: "POST", body: {} }),
  verifyPayment: (body) => request("/api/public/payments/verify", { method: "POST", body }),
  paymentStatus: (body) => request("/api/public/payments/status", { method: "POST", body }),
  enrollmentRequest: (courseId, body) => request(`/api/public/courses/${courseId}/enrollment-request`, { method: "POST", body }),
  enroll: (courseId, body) => request(`/api/public/courses/${courseId}/enroll`, { method: "POST", body }),
};

/** Ids of topics (in a category) that have published articles in `language`. */
async function topicIdsWithArticles(categoryId, language, signal) {
  const ids = new Set();
  for (let page = 1; page <= 5; page++) {
    const batch = await publicApi.articles({ categoryId, language, limit: 100, page }, signal);
    batch.forEach((a) => a.topicId && ids.add(a.topicId));
    if (batch.length < 100) break;
  }
  return ids;
}

/**
 * Categories of one section type (aqeedah | masail), each with its topics.
 * With `language`, topics without any published article in that language are hidden.
 */
export async function loadSection(type, { language, signal } = {}) {
  const cats = (await publicApi.categories(signal)).filter((c) => c.type === type).sort((a, b) => a.ordering - b.ordering);
  return Promise.all(
    cats.map(async (c) => {
      const [topics, allowed] = await Promise.all([
        publicApi.topics(c.id, signal),
        language ? topicIdsWithArticles(c.id, language, signal) : null,
      ]);
      return { ...c, topics: topics.filter((tp) => !allowed || allowed.has(tp.id)).sort((a, b) => a.ordering - b.ordering) };
    })
  );
}

/** All published articles of one section type (aqeedah | masail), newest first, plus its categories. */
export async function loadSectionArticles(type, signal) {
  const cats = (await publicApi.categories(signal)).filter((c) => c.type === type);
  const lists = await Promise.all(cats.map((c) => publicApi.articles({ categoryId: c.id, limit: 100 }, signal)));
  const articles = lists.flat().sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
  return { cats, articles };
}

/** Every published article across all categories (newest first), plus the categories. */
export async function loadAllArticles(signal) {
  const cats = await publicApi.categories(signal);
  const articles = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await publicApi.articles({ limit: 100, page }, signal);
    articles.push(...batch);
    if (batch.length < 100) break;
  }
  return { cats, articles };
}
