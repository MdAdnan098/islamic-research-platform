import * as course from "../controllers/course.controller.js";

export const routes = [
  ["GET", "/api/admin/courses", course.adminList],
  ["POST", "/api/admin/courses", course.adminCreate],
  ["POST", "/api/admin/courses/reorder", course.adminReorder],
  ["GET", "/api/admin/courses/:id", course.adminGet],
  ["PATCH", "/api/admin/courses/:id", course.adminUpdate],
  ["POST", "/api/admin/courses/:id/archive", course.adminArchive],
  ["DELETE", "/api/admin/courses/:id", course.adminRemove],
];
