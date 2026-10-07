// Cloudflare Pages Function: GET /sitemap.xml
// Builds the sitemap from the public API on every (cached) request, so new articles / topics / courses
// appear without a redeploy. Only public, indexable routes are listed - never /admin, /api or redirects.
// If the API is unreachable the sitemap still returns a valid file with the static pages.
const SITE = "https://atharitv-website.pages.dev";
// Same default + override as functions/api/[[path]].js
const DEFAULT_API_ORIGIN = "https://atharitvbackend.debatermuhammadrazasalafi.workers.dev";

// Public static routes (see src/app/router.jsx). "/home" is a redirect, so it is intentionally excluded.
const STATIC_PAGES = ["/", "/aqaid", "/masail", "/latest", "/live", "/courses", "/about", "/disclaimer", "/privacy"];
// Category type -> URL section used by the topic pages (/aqaid/:topic, /masail/:topic).
const SECTION_PATH = { aqeedah: "aqaid", masail: "masail" };

const MAX_URLS = 50000; // sitemap protocol limit
const PAGE_SIZE = 100; // backend caps list size at 100
const MAX_PAGES = 100;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function isoDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const apiOrigin = (env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, "");
  let complete = true;

  async function api(path) {
    try {
      const res = await fetch(apiOrigin + path, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      return body && body.success ? body.data : null;
    } catch {
      complete = false;
      return null;
    }
  }

  const entries = new Map(); // loc -> lastmod (or null); Map keeps each URL once
  const add = (path, lastmod) => { if (entries.size < MAX_URLS && !entries.has(path)) entries.set(path, isoDate(lastmod)); };

  STATIC_PAGES.forEach((p) => add(p, null));

  // Published articles (the API only ever returns published ones).
  const topicsWithPosts = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await api(`/api/public/articles?limit=${PAGE_SIZE}&page=${page}`);
    const batch = data?.articles || [];
    for (const a of batch) {
      if (!a?.slug) continue;
      add(`/article/${encodeURIComponent(a.slug)}`, a.updatedAt || a.publishedAt);
      if (a.topicId) topicsWithPosts.add(a.topicId);
    }
    if (batch.length < PAGE_SIZE) break;
  }

  // Topic pages - only topics that actually have published posts (empty topic pages are thin content).
  const catData = await api("/api/public/categories");
  for (const c of catData?.categories || []) {
    const section = SECTION_PATH[c.type];
    if (!section) continue;
    const t = await api(`/api/public/topics?categoryId=${encodeURIComponent(c.id)}`);
    for (const topic of t?.topics || []) {
      if (topic?.slug && topicsWithPosts.has(topic.id)) add(`/${section}/${encodeURIComponent(topic.slug)}`, topic.updatedAt);
    }
  }

  // Published courses.
  const courseData = await api("/api/public/courses");
  for (const c of courseData?.courses || []) {
    if (c?.slug) add(`/courses/${encodeURIComponent(c.slug)}`, c.updatedAt);
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...entries].map(([path, lastmod]) => `  <url><loc>${esc(SITE + path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("\n") +
    "\n</urlset>\n";

  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Shorter cache when part of the data could not be loaded, so a hiccup heals quickly.
      "Cache-Control": complete ? "public, max-age=3600, s-maxage=3600" : "public, max-age=300, s-maxage=300",
    },
  });
}
