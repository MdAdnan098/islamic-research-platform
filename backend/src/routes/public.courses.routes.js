import * as course from "../controllers/course.controller.js";

export const routes = [
  ["GET", "/api/public/courses", course.publicList],
  ["GET", "/api/public/courses/:slug", course.publicBySlug],
];
