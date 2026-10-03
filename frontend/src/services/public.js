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
