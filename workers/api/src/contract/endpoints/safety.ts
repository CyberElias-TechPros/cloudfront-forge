/**
 * safety endpoints — generated into the contract registry (PLAT-002).
 *
 * One entry per route in the router table; `tests/contract/openapi.test.ts` fails
 * if an entry does not match a real route, so these cannot drift.
 */
import type { EndpointContract } from "../contract-types";
import { reportCreateSchema, reportAppealSchema, appealReviewSchema } from "../schemas/moderation";
import { reportCreateResponseSchema, myReportListResponseSchema, actionMessageSchema } from "../schemas/views";

export const safetyEndpoints: EndpointContract[] = [
  {
    route: { method: "POST", path: "/api/v1/reports" },
    path: "/api/v1/reports",
    operationId: "createReport",
    summary: "Report a video, review, comment, member or squad",
    tag: "Safety",
    auth: "user",
    request: reportCreateSchema,
    response: reportCreateResponseSchema,
    errors: ["CONFLICT"],
  },
  {
    route: { method: "GET", path: "/api/v1/reports/mine" },
    path: "/api/v1/reports/mine",
    operationId: "listMyReports",
    summary: "Reports the caller filed, with appeal state",
    tag: "Safety",
    auth: "user",
    response: myReportListResponseSchema,
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/reports/([^/]+)/appeal$" },
    path: "/api/v1/reports/{reportId}/appeal",
    operationId: "appealReport",
    summary: "Appeal a report the caller was named in",
    tag: "Safety",
    auth: "user",
    request: reportAppealSchema,
    response: actionMessageSchema,
    errors: ["BAD_REQUEST", "CONFLICT", "FORBIDDEN"],
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/admin/appeals/([^/]+)$" },
    path: "/api/v1/admin/appeals/{appealId}",
    operationId: "reviewAppeal",
    summary: "Accept or reject an appeal",
    tag: "Safety",
    auth: "moderator",
    request: appealReviewSchema,
    response: actionMessageSchema,
    errors: ["CONFLICT", "FORBIDDEN"],
  },
];
