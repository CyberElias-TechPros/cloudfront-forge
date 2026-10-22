/**
 * discovery endpoints — generated into the contract registry (PLAT-002).
 *
 * One entry per route in the router table; `tests/contract/openapi.test.ts` fails
 * if an entry does not match a real route, so these cannot drift.
 */
import type { EndpointContract } from "../contract-types";
import { searchResponseSchema, discoverResponseSchema } from "../schemas/views";

export const discoveryEndpoints: EndpointContract[] = [
  {
    route: { method: "GET", path: "/api/v1/search" },
    path: "/api/v1/search",
    operationId: "search",
    summary: "Search squads and videos",
    tag: "Discovery",
    auth: "user",
    response: searchResponseSchema,
    query: [{ name: "q", required: true, description: "Free-text query (min 2 characters)." }],
  },
  {
    route: { method: "GET", path: "/api/v1/discover/collaborators" },
    path: "/api/v1/discover/collaborators",
    operationId: "listCollaborators",
    summary: "Members open to collaborating",
    tag: "Discovery",
    auth: "user",
    response: discoverResponseSchema,
    query: [{ name: "intent", enum: ["collaboration", "feedback", "support", "mentorship"] },
      { name: "limit", type: "integer" }],
  },
];
