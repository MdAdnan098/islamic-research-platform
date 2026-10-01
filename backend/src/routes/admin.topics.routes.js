import * as topicController from "../controllers/topic.controller.js";

export const routes = [
  ["GET", "/api/admin/topics", topicController.list],
  ["POST", "/api/admin/topics", topicController.create],
  ["POST", "/api/admin/topics/reorder", topicController.reorder],
  ["GET", "/api/admin/topics/:id", topicController.getOne],
  ["PATCH", "/api/admin/topics/:id", topicController.update],
  ["POST", "/api/admin/topics/:id/archive", topicController.archive],
];
