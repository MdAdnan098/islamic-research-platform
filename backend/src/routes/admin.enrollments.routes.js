import * as enrollment from "../controllers/enrollment.controller.js";
import * as payment from "../controllers/payment.controller.js";

export const routes = [
  ["GET", "/api/admin/enrollments", enrollment.adminList],
  ["GET", "/api/admin/enrollments/:id", enrollment.adminGet],
  ["PATCH", "/api/admin/enrollments/:id", enrollment.adminUpdate],
  ["GET", "/api/admin/payments", payment.adminList],
];
