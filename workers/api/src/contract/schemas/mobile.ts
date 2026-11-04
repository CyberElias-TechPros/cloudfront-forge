import { z } from "zod";

export const mobileConfigResponseSchema = z.object({
  apiVersion: z.string(),
  minAndroidVersionCode: z.number(),
  maintenance: z.boolean(),
  watchSessionsEnabled: z.boolean(),
  billingEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  coachEnabled: z.boolean(),
  youtubeEnabled: z.boolean(),
  policyVersion: z.string(),
});

export const deviceRegisterSchema = z.object({
  token: z.string().min(20).max(4096),
  installationId: z.string().uuid(),
});
export const deviceDeleteSchema = z.object({ installationId: z.string().uuid() });
export const consentSchema = z.object({
  policyVersion: z.string().min(1).max(32),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  ageConfirmed: z.literal(true),
});
export const blockUserSchema = z.object({ userId: z.string().uuid() });
export const blockListResponseSchema = z.object({
  items: z.array(z.object({ id: z.string(), displayName: z.string().nullable().optional(), createdAt: z.string() })),
});
export const billingCatalogResponseSchema = z.object({
  enabled: z.boolean(),
  products: z.array(z.object({ productId: z.string(), label: z.string(), credits: z.number() })),
});
export const billingVerifySchema = z.object({
  productId: z.string().min(1).max(100).regex(/^[a-z0-9_.]+$/),
  purchaseToken: z.string().min(10).max(4096),
});
export const billingVerifyResponseSchema = z.object({
  orderId: z.string(), productId: z.string(), credits: z.number(), balance: z.number(),
  alreadyGranted: z.boolean(), consumed: z.boolean(),
});
export const billingHistoryResponseSchema = z.object({
  items: z.array(z.object({ orderId: z.string(), productId: z.string(), credits: z.number(), status: z.string(), createdAt: z.string() })),
});
export const consentResponseSchema = z.object({ message: z.string(), policyVersion: z.string() });
