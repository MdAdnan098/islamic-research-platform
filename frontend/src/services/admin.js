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
  login: (email, password) => request("/api/admin/login", json("POST", { email, password })).then((d) => d.admin),
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
    reorder: (items) => request("/api/admin/topics/reorder", json("POST", { items })),
  },
  articles: {
    ...crud("/api/admin/articles", "articles", "article"),
    action: (id, name) => request(`/api/admin/articles/${id}/${name}`, json("POST", {})).then((d) => d.article), // publish | unpublish | archive
  },
  references: {
    ...crud("/api/admin/references", "references", "reference"),
    remove: (id) => request(`/api/admin/references/${id}`, { method: "DELETE" }),
  },

  upload(file) {
    const form = new FormData();
    form.append("file", file);
    return request("/api/admin/media", { method: "POST", form });
  },
};
