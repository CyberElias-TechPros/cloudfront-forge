import type { RouteDefinition } from "../types";

/**
 * Route matching for the API.
 *
 * Handlers declare either an exact `path` or a `pattern` (a regular expression
 * source string). Patterns are compiled once and cached — the previous
 * implementation recompiled every pattern on every request.
 */
const patternCache = new Map<string, RegExp>();

function compiled(pattern: string): RegExp {
  let regex = patternCache.get(pattern);
  if (!regex) {
    regex = new RegExp(pattern);
    patternCache.set(pattern, regex);
  }
  return regex;
}

export function matchesRoute(route: RouteDefinition, method: string, path: string): boolean {
  if (route.method !== method) return false;
  if (route.path !== undefined) return route.path === path;
  if (route.pattern !== undefined) {
    const regex = compiled(route.pattern);
    // Reset internal state of a global/sticky regex before testing.
    regex.lastIndex = 0;
    return regex.test(path);
  }
  return false;
}

export function findRoute(
  routes: readonly RouteDefinition[],
  method: string,
  path: string,
): RouteDefinition | undefined {
  return routes.find((route) => matchesRoute(route, method, path));
}

/**
 * Build a concrete URL from a route's `path`/`pattern` — used by the routing
 * tests so every declared route is exercised against a real-looking path.
 */
export function samplePathFor(route: RouteDefinition): string | null {
  if (route.path !== undefined) return route.path;
  if (route.pattern === undefined) return null;
  return route.pattern
    .replace(/\\\\/g, "\\")
    .replace(/\\\//g, "/")
    .replace(/^\^/, "")
    .replace(/\$$/, "")
    .replace(/\(\[\^\/\]\+\)/g, "8f14e45f-ceea-467a-9f68-9e2f0f9c5b21")
    .replace(/\\\./g, ".");
}
