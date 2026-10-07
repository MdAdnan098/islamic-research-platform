import * as live from "../controllers/liveSession.controller.js";

export const routes = [
  ["GET", "/api/public/live-sessions", live.publicList],
  ["GET", "/api/public/live-sessions/:id", live.publicGet],
];
