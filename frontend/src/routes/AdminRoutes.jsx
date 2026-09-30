import { Route, Navigate } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import Login from "../pages/admin/Login.jsx";
import Dashboard from "../pages/admin/Dashboard.jsx";

/**
 * Admin routes.
 * - /admin/login is public (redirects away if already authenticated, see Login.jsx).
 * - Everything else sits behind ProtectedRoute, which redirects
 *   unauthenticated visitors to /admin/login instead of rendering
 *   dashboard content.
 * - /admin (index) redirects to /admin/dashboard once authenticated.
 */
const AdminRoutes = (
  <Route path="/admin">
    <Route path="login" element={<Login />} />

    <Route element={<ProtectedRoute />}>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>
    </Route>
  </Route>
);

export default AdminRoutes;
