import * as course from "../controllers/course.controller.js";
import * as enrollment from "../controllers/enrollment.controller.js";

export const routes = [
  ["GET", "/api/public/courses", course.publicList],
  ["GET", "/api/public/courses/:slug", course.publicBySlug],
  ["POST", "/api/public/courses/:id/enrollment-request", enrollment.requestEnrollment],
];
