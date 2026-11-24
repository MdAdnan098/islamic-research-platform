import * as push from "../controllers/push.controller.js";

export const routes = [
  ["GET", "/api/public/push/status", push.publicStatus],
  ["POST", "/api/public/push/register", push.publicRegister],
  ["PUT", "/api/public/push/preferences", push.publicPreferences],
  ["POST", "/api/public/push/unregister", push.publicUnregister],
];
