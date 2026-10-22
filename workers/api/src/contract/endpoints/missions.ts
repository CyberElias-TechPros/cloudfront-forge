/**
 * missions endpoints — generated into the contract registry (PLAT-002).
 *
 * One entry per route in the router table; `tests/contract/openapi.test.ts` fails
 * if an entry does not match a real route, so these cannot drift.
 */
import type { EndpointContract } from "../contract-types";
import { notificationCreateSchema } from "../schemas/moderation";
import { actionMessageSchema } from "../schemas/views";

export const missionsEndpoints: EndpointContract[] = [
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/missions/assignments/([^/]+)/skip$" },
    path: "/api/v1/missions/assignments/{assignmentId}/skip",
    operationId: "skipMissionAssignment",
    summary: "Skip an assignment (no reward, no penalty beyond the miss)",
    tag: "Missions",
    auth: "user",
    response: actionMessageSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/notifications" },
    path: "/api/v1/notifications",
    operationId: "createNotification",
    summary: "Create a notification for the caller (system/admin use)",
    tag: "Notifications",
    auth: "user",
    request: notificationCreateSchema,
    response: actionMessageSchema,
    errors: ["FORBIDDEN"],
  },
];
