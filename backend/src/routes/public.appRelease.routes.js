import * as app from "../controllers/appRelease.controller.js";

export const routes = [
  ["GET", "/api/public/app-update", app.publicGet],
];
