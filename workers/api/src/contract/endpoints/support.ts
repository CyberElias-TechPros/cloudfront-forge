/**
 * support endpoints — generated into the contract registry (PLAT-002).
 *
 * One entry per route in the router table; `tests/contract/openapi.test.ts` fails
 * if an entry does not match a real route, so these cannot drift.
 */
import type { EndpointContract } from "../contract-types";
import { supportRequestSchema } from "../schemas/moderation";
import { supportCreateResponseSchema, supportTicketListResponseSchema, actionMessageSchema } from "../schemas/views";

export const supportEndpoints: EndpointContract[] = [
  {
    route: { method: "POST", path: "/api/v1/support" },
    path: "/api/v1/support",
    operationId: "createSupportRequest",
    summary: "Contact the team about an account, credit or moderation problem",
    tag: "Support",
    auth: "user",
    request: supportRequestSchema,
    response: supportCreateResponseSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/admin/support" },
    path: "/api/v1/admin/support",
    operationId: "listSupportRequests",
    summary: "Support queue (moderator view)",
    tag: "Support",
    auth: "moderator",
    response: supportTicketListResponseSchema,
    query: [{ name: "status", enum: ["open", "resolved"], default: "open" }],
    errors: ["FORBIDDEN"],
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/admin/support/([^/]+)/resolve$" },
    path: "/api/v1/admin/support/{supportId}/resolve",
    operationId: "resolveSupportRequest",
    summary: "Mark a support request resolved",
    tag: "Support",
    auth: "moderator",
    response: actionMessageSchema,
    errors: ["CONFLICT", "FORBIDDEN"],
  },
];
