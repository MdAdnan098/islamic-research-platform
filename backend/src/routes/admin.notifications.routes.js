import * as push from "../controllers/push.controller.js";

export const routes = [
  ["GET", "/api/admin/notifications", push.adminOverview],
  ["POST", "/api/admin/notifications", push.adminSend],
  // Literal path before the ":id" route.
  ["PUT", "/api/admin/notifications/auto-settings", push.adminSaveAuto],
  ["POST", "/api/admin/notifications/:id/continue", push.adminContinue],
];
