/**
 * Placeholder for admin authentication.
 *
 * Real implementation (to be added in a later phase) will:
 *   - Verify a JWT/session token from the Authorization header
 *   - Look up the admin user
 *   - Attach it to the request context
 *
 * For now this only defines the shape every admin route will call through,
 * and intentionally rejects all requests so no route is accidentally left
 * open before real auth exists.
 *
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<{ id: string, email: string } | null>}
 */
export async function requireAdmin(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    const err = new Error("Missing Authorization header.");
    err.status = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }

  // TODO: verify JWT using env.ADMIN_JWT_SECRET once auth is implemented.
  const err = new Error("Admin authentication is not implemented yet.");
  err.status = 501;
  err.code = "NOT_IMPLEMENTED";
  throw err;
}
