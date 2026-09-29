import { Route } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout.jsx";
import Home from "../pages/public/Home.jsx";
import Aqeedah from "../pages/public/Aqeedah.jsx";
import Masail from "../pages/public/Masail.jsx";

/**
 * Public routes require no authentication.
 * Aqeedah / Masail are placeholder shells until the categories/articles
 * API exists. Full listing/article routes will be added here later.
 */
const PublicRoutes = (
  <Route path="/" element={<PublicLayout />}>
    <Route index element={<Home />} />
    <Route path="aqeedah" element={<Aqeedah />} />
    <Route path="masail" element={<Masail />} />
  </Route>
);

export default PublicRoutes;
