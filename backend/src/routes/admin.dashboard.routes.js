import * as dashboardController from "../controllers/dashboard.controller.js";

export const routes = [
  ["GET", "/api/admin/dashboard-stats", dashboardController.stats],
];
