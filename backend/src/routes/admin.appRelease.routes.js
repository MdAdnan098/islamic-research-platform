import * as app from "../controllers/appRelease.controller.js";

export const routes = [
  ["GET", "/api/admin/app-release", app.adminGet],
  ["PUT", "/api/admin/app-release", app.adminSave],
];
