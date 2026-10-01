import * as referenceController from "../controllers/reference.controller.js";

export const routes = [
  ["GET", "/api/admin/references", referenceController.list],
  ["POST", "/api/admin/references", referenceController.create],
  ["GET", "/api/admin/references/:id", referenceController.getOne],
  ["PATCH", "/api/admin/references/:id", referenceController.update],
  ["DELETE", "/api/admin/references/:id", referenceController.remove],
];
