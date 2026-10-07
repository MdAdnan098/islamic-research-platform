import * as course from "../controllers/course.controller.js";

export const routes = [
  ["GET", "/api/admin/courses", course.adminList],
  ["POST", "/api/admin/courses", course.adminCreate],
  ["GET", "/api/admin/courses/:id", course.adminGet],
  ["PATCH", "/api/admin/courses/:id", course.adminUpdate],
  ["DELETE", "/api/admin/courses/:id", course.adminRemove],
];
