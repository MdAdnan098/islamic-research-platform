import * as categoryController from "../controllers/category.controller.js";

/** [method, pattern, handler] — see utils/router.js for :param matching. */
export const routes = [
  ["GET", "/api/admin/categories", categoryController.list],
  ["POST", "/api/admin/categories", categoryController.create],
  ["POST", "/api/admin/categories/reorder", categoryController.reorder],
  ["GET", "/api/admin/categories/:id", categoryController.getOne],
  ["PATCH", "/api/admin/categories/:id", categoryController.update],
  ["POST", "/api/admin/categories/:id/archive", categoryController.archive],
];
