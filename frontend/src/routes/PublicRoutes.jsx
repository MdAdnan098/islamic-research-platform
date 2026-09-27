import { Route } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout.jsx";
import Home from "../pages/public/Home.jsx";

/**
 * Public routes require no authentication.
 * Aqeedah / Masail / Categories / Articles / Search routes will be
 * added here in a later phase.
 */
const PublicRoutes = (
  <Route path="/" element={<PublicLayout />}>
    <Route index element={<Home />} />
  </Route>
);

export default PublicRoutes;
