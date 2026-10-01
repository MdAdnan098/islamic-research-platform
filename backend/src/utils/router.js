/**
 * Minimal internal route matcher — no routing library.
 * Extends the previous exact-path array with `:param` segments
 * (e.g. "/api/admin/categories/:id") while keeping plain paths working
 * exactly as before.
 *
 * Patterns are compiled once at module load (buildRouter), not per
 * request, so this stays cheap on every fetch.
 */

function compilePattern(pattern) {
  const paramNames = [];
  const regexSource = pattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }
      // Escape any regex-special characters in a literal segment.
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return { regex: new RegExp(`^${regexSource}$`), paramNames };
}

/**
 * @param {Array<[string, string, Function]>} routeDefs - [method, pattern, handler]
 * @returns {{ match: (method: string, pathname: string) => { handler: Function, params: object } | null }}
 */
export function buildRouter(routeDefs) {
  const compiled = routeDefs.map(([method, pattern, handler]) => ({
    method,
    handler,
    ...compilePattern(pattern),
  }));

  function match(method, pathname) {
    for (const route of compiled) {
      if (route.method !== method) continue;
      const result = pathname.match(route.regex);
      if (!result) continue;

      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(result[i + 1]);
      });
      return { handler: route.handler, params };
    }
    return null;
  }

  return { match };
}
