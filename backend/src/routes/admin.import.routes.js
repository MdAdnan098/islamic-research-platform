import * as importController from "../controllers/import.controller.js";

// Both are POST (the URL travels in a JSON body, not in the query string / access logs) and live under
// /api/admin/, so they are authenticated by the router's guardAdmin before the controller runs.
export const routes = [
  ["POST", "/api/admin/import/page", importController.page],
  ["POST", "/api/admin/import/image", importController.image],
];
