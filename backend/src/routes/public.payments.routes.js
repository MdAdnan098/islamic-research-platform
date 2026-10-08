import * as payment from "../controllers/payment.controller.js";
import * as enrollment from "../controllers/enrollment.controller.js";

export const routes = [
  ["POST", "/api/public/courses/:id/payment/order", payment.createOrder],
  ["POST", "/api/public/courses/:id/enroll", enrollment.enroll],
  ["POST", "/api/public/courses/:id/access", enrollment.access],
  ["POST", "/api/public/payments/verify", payment.verify],
  ["POST", "/api/public/payments/status", payment.status],
  ["POST", "/api/public/payments/webhook", payment.webhook],
];
