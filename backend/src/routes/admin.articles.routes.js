import * as articleController from "../controllers/article.controller.js";

export const routes = [
  ["GET", "/api/admin/articles", articleController.list],
  ["POST", "/api/admin/articles", articleController.create],
  ["GET", "/api/admin/articles/:id", articleController.getOne],
  ["PATCH", "/api/admin/articles/:id", articleController.update],
  ["PATCH", "/api/admin/articles/:id/highlights", articleController.highlights],
  ["PUT", "/api/admin/articles/:id/draft", articleController.saveDraft],
  ["DELETE", "/api/admin/articles/:id/draft", articleController.discardDraft],
  ["DELETE", "/api/admin/articles/:id", articleController.remove],
  ["DELETE", "/api/admin/articles", articleController.removeAll],
  ["POST", "/api/admin/articles/:id/archive", articleController.archive],
  ["POST", "/api/admin/articles/:id/publish", articleController.publish],
  ["POST", "/api/admin/articles/:id/unpublish", articleController.unpublish],
];
