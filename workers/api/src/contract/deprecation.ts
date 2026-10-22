/**
 * Endpoint-level deprecation headers (PLAT-018).
 *
 * A deprecated endpoint keeps working, but every response says so:
 * `Deprecation: true` (RFC 9745) and, when a removal date is declared,
 * `Sunset` (RFC 8594) as an HTTP date. Web and Android can then log it, and a
 * reviewer can see *when* the endpoint dies, not just that it will.
 *
 * Nothing is deprecated today. This exists so the first deprecation is a data
 * change in the registry rather than a code change in the router — and so that
 * "deprecated" cannot be forgotten at the edge.
 */
import { endpoints, systemEndpoints } from "./registry";
import type { EndpointContract } from "./contract-types";

const allEndpoints: EndpointContract[] = [...endpoints, ...systemEndpoints];

/** HTTP date for a `Sunset` header, or null when the date is unusable. */
export function sunsetDate(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toUTCString();
}

function matches(endpoint: EndpointContract, method: string, pathname: string): boolean {
  if (endpoint.route.method !== method) return false;
  if (endpoint.route.path !== undefined) return endpoint.route.path === pathname;
  if (endpoint.route.pattern !== undefined)
    return new RegExp(endpoint.route.pattern).test(pathname);
  return false;
}

export function deprecationHeadersFor(
  method: string,
  pathname: string,
  catalogue: EndpointContract[] = allEndpoints,
): Record<string, string> {
  const endpoint = catalogue.find(
    (candidate) => candidate.deprecated === true && matches(candidate, method, pathname),
  );
  if (!endpoint) return {};

  const headers: Record<string, string> = { Deprecation: "true" };
  const sunset = sunsetDate(endpoint.sunset);
  if (sunset) headers["Sunset"] = sunset;
  return headers;
}
