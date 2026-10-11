import * as publicController from "../controllers/public.controller.js";

export const routes = [
  ["GET", "/api/public/home", publicController.home],
  ["GET", "/api/public/categories", publicController.categories],
  ["GET", "/api/public/topics", publicController.topics],
  ["GET", "/api/public/folders", publicController.folders],
  ["GET", "/api/public/folders/by-slug", publicController.folderBySlug],
  ["GET", "/api/public/latest", publicController.latest],
  ["GET", "/api/public/search", publicController.search],
  ["GET", "/api/public/articles", publicController.articles],
  ["GET", "/api/public/references", publicController.references],
  ["GET", "/api/public/articles/:slug", publicController.articleBySlug],
];
