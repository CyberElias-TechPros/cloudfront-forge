/**
 * PLAT-018 — a deprecation is a promise with a date.
 *
 * Nothing is deprecated today, so these tests use a synthetic catalogue: what
 * matters is that the mechanism works the day someone retires an endpoint, and
 * that the registry refuses a deprecation without a sunset date.
 */
import { describe, it, expect } from "vitest";
import { deprecationHeadersFor, sunsetDate } from "../../src/contract/deprecation";
import { endpoints, systemEndpoints } from "../../src/contract/registry";
import type { EndpointContract } from "../../src/contract/contract-types";

const retired: EndpointContract = {
  route: { method: "GET", path: "/api/v1/legacy" },
  path: "/api/v1/legacy",
  operationId: "legacyThing",
  summary: "Retired endpoint",
  tag: "System",
  auth: "public",
  deprecated: true,
  sunset: "2027-01-31T00:00:00Z",
};

const patternRetired: EndpointContract = {
  ...retired,
  route: { method: "DELETE", pattern: "^\\/api\\/v1\\/legacy\\/([^/]+)$" },
  path: "/api/v1/legacy/{id}",
};

describe("deprecation headers", () => {
  it("adds Deprecation and an HTTP-date Sunset", () => {
    const headers = deprecationHeadersFor("GET", "/api/v1/legacy", [retired]);
    expect(headers.Deprecation).toBe("true");
    expect(headers.Sunset).toBe("Sun, 31 Jan 2027 00:00:00 GMT");
  });

  it("matches pattern routes", () => {
    const headers = deprecationHeadersFor("DELETE", "/api/v1/legacy/abc", [patternRetired]);
    expect(headers.Deprecation).toBe("true");
  });

  it("stays silent for live endpoints", () => {
    expect(deprecationHeadersFor("GET", "/api/v1/legacy", [])).toEqual({});
    expect(deprecationHeadersFor("POST", "/api/v1/legacy", [retired])).toEqual({});
  });

  it("omits an unparseable Sunset rather than emitting garbage", () => {
    expect(sunsetDate("not a date")).toBeNull();
    const headers = deprecationHeadersFor("GET", "/api/v1/legacy", [
      { ...retired, sunset: "soon-ish" },
    ]);
    expect(headers.Sunset).toBeUndefined();
    expect(headers.Deprecation).toBe("true");
  });

  it("requires a sunset date on every deprecated endpoint in the catalogue", () => {
    for (const endpoint of [...endpoints, ...systemEndpoints]) {
      if (endpoint.deprecated) {
        expect(
          endpoint.sunset,
          `${endpoint.operationId} is deprecated without a sunset date`,
        ).toBeTruthy();
      }
    }
  });
});
