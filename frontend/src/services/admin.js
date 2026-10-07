import { request, qs } from "../lib/api.js";

const json = (method, body) => ({ method, body });

function crud(base, listKey, itemKey) {
  return {
    list: (params, signal) => request(`${base}${qs(params)}`, { signal }).then((d) => d[listKey]),
    get: (id, signal) => request(`${base}/${id}`, { signal }).then((d) => d[itemKey]),
    create: (body) => request(base, json("POST", body)).then((d) => d[itemKey]),
    update: (id, body) => request(`${base}/${id}`, json("PATCH", body)).then((d) => d[itemKey]),
  };
}

export const adminApi = {
  login: (username, password) => request("/api/admin/login", json("POST", { username, password })).then((d) => d.admin),
  register: (username, password, secretKey) => request("/api/admin/register", json("POST", { username, password, secretKey })),
  resetPassword: (username, secretKey, newPassword) => request("/api/admin/reset-password", json("POST", { username, secretKey, newPassword })),
  logout: () => request("/api/admin/logout", json("POST", {})),
  me: (signal) => request("/api/admin/me", { signal }).then((d) => d.admin),

  categories: {
    ...crud("/api/admin/categories", "categories", "category"),
    archive: (id) => request(`/api/admin/categories/${id}/archive`, json("POST", {})).then((d) => d.category),
    reorder: (items) => request("/api/admin/categories/reorder", json("POST", { items })),
  },
  topics: {
    ...crud("/api/admin/topics", "topics", "topic"),
    archive: (id) => request(`/api/admin/topics/${id}/archive`, json("POST", {})).then((d) => d.topic),
    reorder: (categoryId, items) => request("/api/admin/topics/reorder", json("POST", { categoryId, items })),
  },
  articles: {
    ...crud("/api/admin/articles", "articles", "article"),
    remove: (id) => request(`/api/admin/articles/${id}`, { method: "DELETE" }),
    removeAll: () => request("/api/admin/articles", { method: "DELETE" }),
    action: (id, name) => request(`/api/admin/articles/${id}/${name}`, json("POST", {})).then((d) => d.article), // publish | unpublish | archive
  },
  references: {
    ...crud("/api/admin/references", "references", "reference"),
    remove: (id) => request(`/api/admin/references/${id}`, { method: "DELETE" }),
  },

  liveSessions: {
    ...crud("/api/admin/live-sessions", "sessions", "session"),
    listWithMeta: (params, signal) => request(`/api/admin/live-sessions${qs(params)}`, { signal }), // { sessions, youtubeSync }
    remove: (id) => request(`/api/admin/live-sessions/${id}`, { method: "DELETE" }),
    sync: () => request("/api/admin/live-sessions/sync", json("POST", {})).then((d) => d.sync),
  },
  courses: {
    ...crud("/api/admin/courses", "courses", "course"),
    remove: (id) => request(`/api/admin/courses/${id}`, { method: "DELETE" }),
  },
  enrollments: {
    list: (params, signal) => request(`/api/admin/enrollments${qs(params)}`, { signal }).then((d) => d.enrollments),
    update: (id, body) => request(`/api/admin/enrollments/${id}`, json("PATCH", body)).then((d) => d.enrollment),
  },
  payments: {
    list: (params, signal) => request(`/api/admin/payments${qs(params)}`, { signal }).then((d) => d.payments),
  },

  upload(file) {
    const form = new FormData();
    form.append("file", file);
    return request("/api/admin/media", { method: "POST", form });
  },
};
