import { z } from "zod";
import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { Database, DatabaseError } from "../lib/database";

// Payout account for naira point purchases (bank transfer).
export const NGN_BANK_DETAILS = {
  accountName: "Delgra Ltd",
  accountNumber: "6674684361",
  bankName: "Moniepoint MFB",
} as const;

// Fixed credit packs. Base rate is ~₦50/credit with a volume bonus on
// larger packs. Kept deliberately affordable: the biggest pack is capped at
// ₦10,000 so entry stays cheap and more members keep the site active.
export const TOPUP_TIERS = [
  { id: "starter", name: "Starter", ngn: 1000, credits: 20, bonus: 0 },
  { id: "builder", name: "Builder", ngn: 2500, credits: 54, bonus: 4 },
  { id: "creator", name: "Creator", ngn: 5000, credits: 110, bonus: 10 },
  { id: "studio", name: "Studio", ngn: 10000, credits: 220, bonus: 20 },
] as const;

const tierById: Record<string, (typeof TOPUP_TIERS)[number]> = Object.fromEntries(
  TOPUP_TIERS.map((t) => [t.id, t]),
);

const requestSchema = z.object({
  tierId: z.string().min(1).max(32),
  // Proof of payment is the primary path: a `proof:<path>` token returned by
  // POST /topups/proof, pointing at the receipt stored in R2. The transfer
  // reference is kept as an optional fallback for members whose bank statement
  // shows a reference they'd rather quote than screenshot.
  proofImage: z.string().min(1).max(512).optional(),
  proofImageName: z.string().max(255).optional(),
  proofImageType: z.string().max(64).optional(),
  transferReference: z
    .string()
    .trim()
    .min(4, "Transfer reference is too short")
    .max(64)
    .regex(
      /^[A-Za-z0-9\-_/+]+$/,
      "Transfer reference may only contain letters, numbers, dashes, underscores, slashes or plus signs",
    )
    .optional(),
});

const TOPUP_STATUSES = ["pending", "approved", "rejected"] as const;

// Receipt images uploaded via POST /topups/proof. Admin browsers can render
// every one of these natively, so we deliberately exclude HEIC/other formats
// to keep the review queue trustworthy.
const ALLOWED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Minimal shape of an uploaded multipart file (Workers runtime `File`). */
interface UploadedImage {
  name?: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const MAX_PROOF_SIZE = 5 * 1024 * 1024; // 5MB

export const topupRoutes: RouteDefinition[] = [
  // GET /topups — NGN catalog: packs, payout account, and whether the caller
  // already has a pending request.
  {
    method: "GET",
    path: "/api/v1/topups",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const pending = await db.querySingle(
          "SELECT id FROM topup_requests WHERE user_id = ? AND status = 'pending'",
          [userId],
        );
        return createResponse({
          tiers: TOPUP_TIERS,
          bank: NGN_BANK_DETAILS,
          pending: !!pending,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch top-up catalog", 500);
      }
    },
  },

  // POST /topups/proof — upload a screenshot of the completed bank transfer.
  // Stores the receipt in the ASSETS_BUCKET R2 bucket and returns the object
  // key (`path`) plus the original file name/type so the caller can attach it
  // to a top-up request.
  {
    method: "POST",
    path: "/api/v1/topups/proof",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const form = await request.formData().catch(() => null);
        if (!form) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            "Expected multipart/form-data with an 'image' field",
            400,
          );
        }
        // `form.get()` is typed as `File | string | null`; the Workers runtime
        // only ever yields a File here, and the narrowed union is unusable
        // under `strict`, so validate the shape we actually need.
        const file = form.get("image") as unknown as UploadedImage | null;
        if (!file || typeof file.arrayBuffer !== "function" || typeof file.type !== "string") {
          return createErrorResponse("VALIDATION_ERROR", "Missing proof-of-payment image", 400);
        }
        if (!ALLOWED_PROOF_TYPES.has(file.type)) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            "Proof must be a JPEG, PNG or WebP image",
            400,
          );
        }
        if (file.size > MAX_PROOF_SIZE) {
          return createErrorResponse("VALIDATION_ERROR", "Proof image must be 5MB or smaller", 400);
        }

        const bytes = await file.arrayBuffer();
        const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
        const path = `topup-proofs/${userId}/${crypto.randomUUID()}.${ext}`;

        await env.ASSETS_BUCKET.put(path, bytes, {
          httpMetadata: { contentType: file.type },
        });

        return createResponse({ path, name: file.name || path, type: file.type }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to upload proof", 500);
      }
    },
  },

  // POST /topups — submit a completed bank transfer for review.
  {
    method: "POST",
    path: "/api/v1/topups",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = await request.json().catch(() => ({}));
        const validation = requestSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        const tier = tierById[validation.data.tierId];
        if (!tier) {
          return createErrorResponse("VALIDATION_ERROR", "Unknown top-up pack", 400);
        }

        const proofImage = validation.data.proofImage ?? "";
        const transferRef = (validation.data.transferReference ?? "").trim();
        if (!proofImage && transferRef.length < 4) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            "Upload a proof of payment or provide the transfer reference",
            400,
          );
        }
        // transfer_reference is NOT NULL and has a unique-pending index. When
        // only a proof was uploaded we store a synthetic `proof:<path>` token —
        // the path is unique per upload, so the unique constraint stays intact.
        const referenceToken = transferRef.length >= 4 ? transferRef : `proof:${proofImage}`;

        const db = new Database(env);
        const now = new Date().toISOString();

        const pending = await db.querySingle(
          "SELECT id FROM topup_requests WHERE user_id = ? AND status = 'pending'",
          [userId],
        );
        if (pending) {
          return createErrorResponse(
            "CONFLICT",
            "You already have a pending top-up request — it will be reviewed shortly",
            409,
          );
        }

        // A reference may only await review once (including another member
        // quoting a reference they do not own). Checked explicitly because the
        // partial unique index is only the last line of defence: Database.execute
        // throws on constraint violations, so relying on the index alone turned
        // a duplicate submission into an opaque 500.
        const pendingReference = await db.querySingle(
          "SELECT id FROM topup_requests WHERE transfer_reference = ? AND status = 'pending'",
          [referenceToken],
        );
        if (pendingReference) {
          return createErrorResponse(
            "CONFLICT",
            "A pending top-up already exists for this transfer reference",
            409,
          );
        }

        const id = db.uuid();
        let insert: { success: boolean };
        try {
          insert = await db.execute(
            `INSERT INTO topup_requests
             (id, user_id, tier_id, ngn_amount, credits_amount, transfer_reference,
              proof_image_path, proof_image_name, proof_image_type,
              status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [
              id,
              userId,
              tier.id,
              tier.ngn,
              tier.credits,
              referenceToken,
              proofImage || null,
              proofImage ? (validation.data.proofImageName ?? proofImage) : null,
              proofImage ? (validation.data.proofImageType ?? null) : null,
              now,
              now,
            ],
          );
        } catch (error) {
          // Two members racing on the same reference: the loser of the race
          // still gets an actionable 409.
          if (error instanceof DatabaseError) {
            return createErrorResponse(
              "CONFLICT",
              "A pending top-up already exists for this transfer reference",
              409,
            );
          }
          throw error;
        }
        if (!insert.success) {
          return createErrorResponse(
            "CONFLICT",
            "A pending top-up already exists for this transfer reference",
            409,
          );
        }

        const row = await db.querySingle("SELECT * FROM topup_requests WHERE id = ?", [id]);
        return createResponse({ message: "Top-up submitted for review", request: row }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit top-up", 500);
      }
    },
  },

  // GET /topups/mine — the caller's top-up history.
  {
    method: "GET",
    path: "/api/v1/topups/mine",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const result = await db.query(
          "SELECT * FROM topup_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
          [userId],
        );
        return createResponse({ items: result.results });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch top-ups", 500);
      }
    },
  },

  // GET /admin/topups?status=pending|approved|rejected — admin queue.
  {
    method: "GET",
    path: "/api/v1/admin/topups",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const db = new Database(env);
        const status = new URL(request.url).searchParams.get("status") ?? "pending";
        if (!TOPUP_STATUSES.includes(status as (typeof TOPUP_STATUSES)[number])) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            `status must be one of: ${TOPUP_STATUSES.join(", ")}`,
            400,
          );
        }
        const result = await db.query(
          `SELECT t.*, u.display_name, u.email
           FROM topup_requests t
           LEFT JOIN users u ON u.id = t.user_id
           WHERE t.status = ?
           ORDER BY t.created_at DESC
           LIMIT 100`,
          [status],
        );
        return createResponse({ items: result.results });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch top-ups", 500);
      }
    },
  },

  // GET /admin/topups/:id/proof — serve the receipt image for review. Admin
  // only; streams the object straight out of R2.
  {
    method: "GET",
    pattern: "^\\/api\\/v1/admin/topups/([^/]+)/proof$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const topupId = new URL(request.url).pathname.split("/")[5] ?? "";
        const db = new Database(env);
        const topup = await db.querySingle(
          "SELECT proof_image_path FROM topup_requests WHERE id = ?",
          [topupId],
        );
        if (!topup?.proof_image_path) {
          return createErrorResponse("NOT_FOUND", "No proof image for this top-up", 404);
        }

        const object = await env.ASSETS_BUCKET.get(topup.proof_image_path);
        if (!object) {
          return createErrorResponse("NOT_FOUND", "Proof image not found", 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Content-Type", object.httpMetadata?.contentType ?? "image/jpeg");
        headers.set("Cache-Control", "private, max-age=300");
        return new Response(object.body, { headers });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to load proof", 500);
      }
    },
  },

  // POST /admin/topups/:id/approve — issue the credits.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/topups/([^/]+)/approve$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const topupId = new URL(request.url).pathname.split("/")[5] ?? "";
        const db = new Database(env);
        const now = new Date().toISOString();

        const topup = await db.querySingle("SELECT * FROM topup_requests WHERE id = ?", [topupId]);
        if (!topup) {
          return createErrorResponse("NOT_FOUND", "Top-up not found", 404);
        }

        // Atomic review lock: only the first approve/reject can transition
        // a pending request.
        const lock = await db.execute(
          "UPDATE topup_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
          [adminId, now, now, topupId],
        );
        if (!lock.success || lock.meta?.changes !== 1) {
          return createErrorResponse("CONFLICT", "Top-up already reviewed", 409);
        }

        const balanceRow = await db.querySingle(
          "SELECT balance FROM credit_accounts WHERE user_id = ?",
          [topup.user_id],
        );
        const balanceAfter =
          ((balanceRow?.balance as number | undefined) ?? 0) + topup.credits_amount;

        // Use the member's quoted reference when they provided one; otherwise
        // fall back to the uploaded receipt's file name (never the synthetic
        // `proof:<path>` token we persist to satisfy NOT NULL).
        const transferLabel = topup.proof_image_name
          ? topup.proof_image_name
          : typeof topup.transfer_reference === "string" &&
              topup.transfer_reference.startsWith("proof:")
            ? "proof of payment"
            : topup.transfer_reference;

        const batchOk = await db.batch([
          {
            sql: `INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at)
                  VALUES (?, ?, 0, ?, ?)
                  ON CONFLICT(user_id) DO NOTHING`,
            params: [db.uuid(), topup.user_id, now, now],
          },
          {
            sql: "UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
            params: [topup.credits_amount, now, topup.user_id],
          },
          {
            sql: `INSERT INTO credit_transactions
                  (id, user_id, type, amount, balance_after, description, reference_id, created_at)
                  VALUES (?, ?, 'admin', ?, ?, ?, ?, ?)`,
            params: [
              db.uuid(),
              topup.user_id,
              topup.credits_amount,
              balanceAfter,
              `NGN top-up (ref: ${transferLabel})`,
              topupId,
              now,
            ],
          },
          {
            sql: `INSERT INTO notifications
                  (id, user_id, type, title, message, created_at)
                  VALUES (?, ?, 'TOPUP_APPROVED', 'Top-up approved', ?, ?)`,
            params: [
              db.uuid(),
              topup.user_id,
              `Your \u20a6${topup.ngn_amount.toLocaleString()} transfer was verified — ${topup.credits_amount} credits added.`,
              now,
            ],
          },
        ]);
        if (!batchOk) {
          throw new Error("Failed to credit approved top-up");
        }

        await recordAudit(
          db,
          {
            actorId: adminId,
            action: "topup.approve",
            resourceType: "topup_request",
            resourceId: topupId,
            request,
            metadata: {
              credits: topup.credits_amount,
              ngn: topup.ngn_amount,
              memberId: topup.user_id,
            },
          },
          env,
        );

        const balanceRowAfter = await db.querySingle(
          "SELECT balance FROM credit_accounts WHERE user_id = ?",
          [topup.user_id],
        );
        return createResponse({
          message: "Top-up approved and credits issued",
          credits: topup.credits_amount,
          balance: balanceRowAfter?.balance ?? 0,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to approve top-up", 500);
      }
    },
  },

  // POST /admin/topups/:id/reject — decline the transfer.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/topups/([^/]+)/reject$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const topupId = new URL(request.url).pathname.split("/")[5] ?? "";
        const body = (await request.json().catch(() => ({}))) as any;
        const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
        const db = new Database(env);
        const now = new Date().toISOString();

        const topup = await db.querySingle("SELECT * FROM topup_requests WHERE id = ?", [topupId]);
        if (!topup) {
          return createErrorResponse("NOT_FOUND", "Top-up not found", 404);
        }

        const lock = await db.execute(
          "UPDATE topup_requests SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
          [reason || null, adminId, now, now, topupId],
        );
        if (!lock.success || lock.meta?.changes !== 1) {
          return createErrorResponse("CONFLICT", "Top-up already reviewed", 409);
        }

        await recordAudit(
          db,
          {
            actorId: adminId,
            action: "topup.reject",
            resourceType: "topup_request",
            resourceId: topupId,
            request,
            metadata: {
              ngn: topup.ngn_amount,
              memberId: topup.user_id,
              ...(reason ? { reason } : {}),
            },
          },
          env,
        );

        await db.execute(
          `INSERT INTO notifications (id, user_id, type, title, message, created_at)
           VALUES (?, ?, 'TOPUP_REJECTED', 'Top-up rejected', ?, ?)`,
          [
            db.uuid(),
            topup.user_id,
            reason
              ? `Your \u20a6${topup.ngn_amount.toLocaleString()} top-up was not credited: ${reason}`
              : `Your \u20a6${topup.ngn_amount.toLocaleString()} top-up was not credited. Please contact support.`,
            now,
          ],
        );

        return createResponse({ message: "Top-up rejected" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to reject top-up", 500);
      }
    },
  },
];
