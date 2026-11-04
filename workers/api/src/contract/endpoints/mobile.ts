import type { EndpointContract } from "../contract-types";
import { actionMessageSchema } from "../schemas/views";
import {
  mobileConfigResponseSchema, deviceRegisterSchema, deviceDeleteSchema, consentSchema,
  consentResponseSchema, blockUserSchema, blockListResponseSchema,
  billingCatalogResponseSchema, billingVerifySchema, billingVerifyResponseSchema, billingHistoryResponseSchema,
} from "../schemas/mobile";

export const mobileEndpoints: EndpointContract[] = [
  { route: { method: "GET", path: "/api/v1/mobile/config" }, path: "/api/v1/mobile/config", operationId: "getMobileConfig", summary: "Native client capability and compatibility flags", tag: "Mobile", auth: "public", response: mobileConfigResponseSchema },
  { route: { method: "POST", path: "/api/v1/mobile/devices" }, path: "/api/v1/mobile/devices", operationId: "registerMobileDevice", summary: "Register an FCM token for this account and installation", tag: "Mobile", auth: "user", request: deviceRegisterSchema, response: actionMessageSchema, errors: ["SERVICE_UNAVAILABLE"] },
  { route: { method: "DELETE", path: "/api/v1/mobile/devices" }, path: "/api/v1/mobile/devices", operationId: "removeMobileDevice", summary: "Remove this installation's push token", tag: "Mobile", auth: "user", request: deviceDeleteSchema, response: actionMessageSchema },
  { route: { method: "POST", path: "/api/v1/mobile/consent" }, path: "/api/v1/mobile/consent", operationId: "recordMobileConsent", summary: "Record acceptance of the current terms and privacy notice", tag: "Mobile", auth: "user", request: consentSchema, response: consentResponseSchema },
  { route: { method: "GET", path: "/api/v1/users/me/blocks" }, path: "/api/v1/users/me/blocks", operationId: "listBlockedMembers", summary: "Members blocked by the caller", tag: "Safety", auth: "user", response: blockListResponseSchema },
  { route: { method: "POST", path: "/api/v1/users/me/blocks" }, path: "/api/v1/users/me/blocks", operationId: "blockMember", summary: "Hide a member's content in both directions", tag: "Safety", auth: "user", request: blockUserSchema, response: actionMessageSchema, errors: ["BAD_REQUEST"] },
  { route: { method: "DELETE", pattern: "^\\/api\\/v1/users/me/blocks/([^/]+)$" }, path: "/api/v1/users/me/blocks/{userId}", operationId: "unblockMember", summary: "Unblock a member", tag: "Safety", auth: "user", response: actionMessageSchema },
  { route: { method: "GET", path: "/api/v1/billing/products" }, path: "/api/v1/billing/products", operationId: "listCreditProducts", summary: "Server-authoritative Play credit products; prices come from Play", tag: "Billing", auth: "user", response: billingCatalogResponseSchema },
  { route: { method: "GET", path: "/api/v1/billing/purchases" }, path: "/api/v1/billing/purchases", operationId: "listPlayPurchases", summary: "The caller's verified Play purchase history", tag: "Billing", auth: "user", response: billingHistoryResponseSchema },
  { route: { method: "POST", path: "/api/v1/billing/verify" }, path: "/api/v1/billing/verify", operationId: "verifyPlayPurchase", summary: "Verify, grant once and consume a Play purchase", tag: "Billing", auth: "user", request: billingVerifySchema, response: billingVerifyResponseSchema, errors: ["CONFLICT", "FORBIDDEN", "SERVICE_UNAVAILABLE"] },
];
