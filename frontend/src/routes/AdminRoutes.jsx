import { Route } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout.jsx";
import Login from "../pages/admin/Login.jsx";
import Dashboard from "../pages/admin/Dashboard.jsx";

/**
 * Admin routes. Route-level auth guarding (redirecting unauthenticated
 * users to /admin/login) will be added once real authentication exists.
 */
const AdminRoutes = (
  <Route path="/admin" element={<AdminLayout />}>
    <Route path="login" element={<Login />} />
    <Route path="dashboard" element={<Dashboard />} />
  </Route>
);

export default AdminRoutes;
