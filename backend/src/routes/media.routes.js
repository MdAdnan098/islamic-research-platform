import * as mediaController from "../controllers/media.controller.js";

export const routes = [
  ["POST", "/api/admin/media", mediaController.upload],
  ["GET", "/api/public/media/:key", mediaController.serve],
];
