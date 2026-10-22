/**
 * topups-admin endpoints — generated into the contract registry (PLAT-002).
 *
 * One entry per route in the router table; `tests/contract/openapi.test.ts` fails
 * if an entry does not match a real route, so these cannot drift.
 */
import { z } from "zod";
import type { EndpointContract } from "../contract-types";
import { freeFormDataSchema } from "../schemas/responses";
import { topupRejectSchema } from "../schemas/moderation";
import { proofUploadResponseSchema, topupApproveResponseSchema, actionMessageSchema } from "../schemas/views";

export const topupsadminEndpoints: EndpointContract[] = [
  {
    route: { method: "POST", path: "/api/v1/topups/proof" },
    path: "/api/v1/topups/proof",
    operationId: "uploadTopupProof",
    summary: "Upload a payment receipt to R2",
    description:
      "multipart/form-data with a single `file` field (jpeg/png/webp, max 5 MB). Returns the `proof:<path>` token to send with the top-up.",
    tag: "Top-ups",
    auth: "user",
    request: z.object({ file: z.unknown() }),
    contentType: "multipart/form-data",
    response: proofUploadResponseSchema,
  },
  {
    route: { method: "GET", pattern: "^\\/api\\/v1/admin/topups/([^/]+)/proof$" },
    path: "/api/v1/admin/topups/{topupId}/proof",
    operationId: "getTopupProof",
    summary: "Receipt image for a top-up (admin browsers render it inline)",
    description:
      "Binary image response (jpeg/png/webp), not a JSON envelope.",
    tag: "Top-ups",
    auth: "admin",
    response: freeFormDataSchema,
    responseContentType: "image/*",
    errors: ["FORBIDDEN"],
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/admin/topups/([^/]+)/approve$" },
    path: "/api/v1/admin/topups/{topupId}/approve",
    operationId: "approveTopup",
    summary: "Approve a transfer and credit the account",
    tag: "Top-ups",
    auth: "admin",
    response: topupApproveResponseSchema,
    errors: ["CONFLICT", "FORBIDDEN"],
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/admin/topups/([^/]+)/reject$" },
    path: "/api/v1/admin/topups/{topupId}/reject",
    operationId: "rejectTopup",
    summary: "Decline a transfer with a reason",
    tag: "Top-ups",
    auth: "admin",
    request: topupRejectSchema,
    response: actionMessageSchema,
    errors: ["CONFLICT", "FORBIDDEN"],
  },
];
