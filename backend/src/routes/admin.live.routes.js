import * as live from "../controllers/liveSession.controller.js";

export const routes = [
  ["GET", "/api/admin/live-sessions", live.adminList],
  ["POST", "/api/admin/live-sessions", live.adminCreate],
  // Literal path must come before the ":id" routes.
  ["POST", "/api/admin/live-sessions/sync", live.adminSync],
  ["GET", "/api/admin/live-sessions/:id", live.adminGet],
  ["PATCH", "/api/admin/live-sessions/:id", live.adminUpdate],
  ["DELETE", "/api/admin/live-sessions/:id", live.adminRemove],
];
