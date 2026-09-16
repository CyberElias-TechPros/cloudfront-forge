import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { recordAudit } from "../lib/audit";
import { generateInviteCode } from "../lib/utils";
import { sanitize } from "../lib/sanitize";
import { notifyUserPush } from "../lib/push";
import { z } from "zod";

/**
 * Community lifecycle and member management.
 *
 * The original surface let members join a community but gave them no way to
 * leave, gave owners no way to moderate their roster, and left the
 * `require_approval` setting dead. These routes close that loop:
 *
 * - members can leave (owners must archive instead of abandoning);
 * - public communities accept join requests, optionally gated by approval;
 * - owners/moderators approve or reject pending requests;
 * - owners promote/demote moderators and remove members;
 * - owners regenerate a leaked invite code;
 * - owners archive a community (soft delete — history stays auditable).
 */

const roleSchema = z.object({
  role: z.enum(["member", "moderator"]),
});

const joinRequestSchema = z.object({
  message: z.string().max(300).optional(),
});

function communityIdFrom(pathname: string): string | undefined {
  // /api/v1/communities/:id[/...]
  return pathname.split("/")[4];
}

async function activeMembership(db: Database, communityId: string, userId: string) {
  return db.querySingle(
    "SELECT id, role, status FROM community_members WHERE community_id = ? AND user_id = ? AND status = 'active'",
    [communityId, userId],
  );
}

async function loadActiveCommunity(db: Database, communityId: string) {
  return db.querySingle(
    "SELECT * FROM communities WHERE id = ? AND status = 'active'",
    [communityId],
  );
}

/** Insert or reactivate a membership row (handles leave/kick then rejoin). */
export async function upsertMembership(
  db: Database,
  communityId: string,
  userId: string,
): Promise<void> {
  const now = db.now();
  const existing = await db.querySingle(
    "SELECT id FROM community_members WHERE community_id = ? AND user_id = ?",
    [communityId, userId],
  );
  if (existing) {
    await db.execute(
      "UPDATE community_members SET status = 'active', role = 'member', joined_at = ? WHERE community_id = ? AND user_id = ?",
      [now, communityId, userId],
    );
  } else {
    await db.execute(
      "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, ?, ?, 'member', ?, 'active')",
      [db.uuid(), communityId, userId, now],
    );
  }
}

async function activeMemberCount(db: Database, communityId: string): Promise<number> {
  const row = await db.querySingle(
    "SELECT COUNT(*) as count FROM community_members WHERE community_id = ? AND status = 'active'",
    [communityId],
  );
  return (row?.count ?? 0) as number;
}

function isManager(role: string): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

function authError(error: any): Response | null {
  if (error.message === "AUTH_REQUIRED" || error.message === "AUTH_TOKEN_INVALID") {
    return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
  }
  return null;
}

export const communityManagementRoutes: RouteDefinition[] = [
  // Member leaves a community. Owners must archive instead.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/communities/([^/]+)/leave$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const communityId = communityIdFrom(new URL(request.url).pathname);
        if (!communityId) return createErrorResponse("VALIDATION_ERROR", "Community ID is required", 400);

        const db = new Database(env);
        const community = await loadActiveCommunity(db, communityId);
        if (!community) return createErrorResponse("NOT_FOUND", "Community not found", 404);

        const membership = await activeMembership(db, communityId, userId);
        if (!membership) return createErrorResponse("NOT_FOUND", "You are not a member of this community", 404);
        if (membership.role === "owner") {
          return createErrorResponse(
            "BAD_REQUEST",
            "Owners cannot leave their own community. Archive it instead.",
            400,
          );
        }

        await db.execute(
          "UPDATE community_members SET status = 'left' WHERE community_id = ? AND user_id = ? AND status = 'active'",
          [communityId, userId],
        );

        await recordAudit(
          db,
          { actorId: userId, action: "community.leave", resourceType: "community", resourceId: communityId, request },
          env,
        );
        return createResponse({ message: "Left community" });
      } catch (error: any) {
        return authError(error) ?? createErrorResponse("INTERNAL_ERROR", "Failed to leave community", 500);
      }
    },
  },

  // Join a public community directly, or request to join when approval is on.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/communities/([^/]+)/join$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const communityId = communityIdFrom(new URL(request.url).pathname);
        if (!communityId) return createErrorResponse("VALIDATION_ERROR", "Community ID is required", 400);

        const db = new Database(env);
        const community = await loadActiveCommunity(db, communityId);
        if (!community) return createErrorResponse("NOT_FOUND", "Community not found", 404);
        if (!community.is_public) {
          return createErrorResponse(
            "BAD_REQUEST",
            "This community is private — join with an invite code",
            400,
          );
        }

        if (await activeMembership(db, communityId, userId)) {
          return createErrorResponse("CONFLICT", "Already a member of this community", 409);
        }

        const memberCount = await activeMemberCount(db, communityId);
        if (memberCount >= community.max_members) {
          return createErrorResponse("FORBIDDEN", "Community is full", 403);
        }

        // Missing settings row keeps the schema default: approval required.
        const settings = await db.querySingle(
          "SELECT require_approval FROM community_settings WHERE community_id = ?",
          [communityId],
        );
        const requireApproval = settings ? Boolean(settings.require_approval) : true;
        const now = db.now();

        if (!requireApproval) {
          await upsertMembership(db, communityId, userId);
          return createResponse({
            message: "Joined community successfully",
            communityId,
            communityName: community.name,
          });
        }

        const pending = await db.querySingle(
          "SELECT id FROM join_requests WHERE community_id = ? AND user_id = ? AND status = 'pending'",
          [communityId, userId],
        );
        if (pending) {
          return createErrorResponse("CONFLICT", "Join request already pending", 409);
        }

        const body = joinRequestSchema.safeParse(await request.json().catch(() => ({})));
        if (!body.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            body.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const requestId = db.uuid();
        await db.execute(
          `INSERT INTO join_requests (id, community_id, user_id, message, status, requested_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [requestId, communityId, userId, body.data.message ? sanitize(body.data.message) : null, now, now, now],
        );

        // Notify community managers about the request.
        const managers = await db.query(
          "SELECT user_id FROM community_members WHERE community_id = ? AND status = 'active' AND role IN ('owner', 'admin', 'moderator')",
          [communityId],
        );
        for (const manager of managers.results as Array<{ user_id: string }>) {
          await db.execute(
            "INSERT INTO notifications (id, user_id, type, title, message, data, created_at) VALUES (?, ?, 'JOIN_REQUEST', 'New join request', ?, ?, ?)",
            [
              db.uuid(),
              manager.user_id,
              `A creator asked to join ${community.name}`,
              JSON.stringify({ communityId, requestId }),
              now,
            ],
          );
          await notifyUserPush(env, manager.user_id, "New join request", `A creator asked to join ${community.name}`);
        }

        return createResponse(
          { message: "Join request submitted for approval", requestId, pending: true },
          202,
        );
      } catch (error: any) {
        return authError(error) ?? createErrorResponse("INTERNAL_ERROR", "Failed to join community", 500);
      }
    },
  },

  // Managers list pending join requests.
  {
    method: "GET",
    pattern: "^\\/api\\/v1/communities/([^/]+)/requests$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const communityId = communityIdFrom(new URL(request.url).pathname);
        if (!communityId) return createErrorResponse("VALIDATION_ERROR", "Community ID is required", 400);

        const db = new Database(env);
        const community = await db.querySingle("SELECT id FROM communities WHERE id = ? AND status = 'active'", [communityId]);
        if (!community) return createErrorResponse("NOT_FOUND", "Community not found", 404);

        const membership = await activeMembership(db, communityId, userId);
        if (!membership || !isManager(membership.role)) {
          return createErrorResponse("FORBIDDEN", "Only community managers can review requests", 403);
        }

        const result = await db.query(
          `SELECT jr.id, jr.message, jr.status, jr.requested_at as requestedAt,
                  u.id as userId, u.display_name as displayName, u.photo_url as photoUrl
           FROM join_requests jr JOIN users u ON jr.user_id = u.id
           WHERE jr.community_id = ? AND jr.status = 'pending'
           ORDER BY jr.requested_at ASC`,
          [communityId],
        );
        return createResponse({ items: result.results });
      } catch (error: any) {
        return authError(error) ?? createErrorResponse("INTERNAL_ERROR", "Failed to list requests", 500);
      }
    },
  },

  // Approve a pending join request.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/communities/([^/]+)/requests/([^/]+)/approve$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const parts = new URL(request.url).pathname.split("/");
        const communityId = parts[4];
        const requestId = parts[6];
        if (!communityId || !requestId) {
          return createErrorResponse("VALIDATION_ERROR", "Community and request IDs are required", 400);
        }

        const db = new Database(env);
        const community = await loadActiveCommunity(db, communityId);
        if (!community) return createErrorResponse("NOT_FOUND", "Community not found", 404);

        const membership = await activeMembership(db, communityId, userId);
        if (!membership || !isManager(membership.role)) {
          return createErrorResponse("FORBIDDEN", "Only community managers can review requests", 403);
        }

        // Status-locked update: exactly one approval can win the request.
        const now = db.now();
        const claimed = await db.execute(
          "UPDATE join_requests SET status = 'approved', reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ? AND community_id = ? AND status = 'pending'",
          [now, userId, now, requestId, communityId],
        );
        if ((claimed.meta?.changes ?? 0) === 0) {
          return createErrorResponse("CONFLICT", "Request was already reviewed", 409);
        }

        const memberCount = await activeMemberCount(db, communityId);
        if (memberCount >= community.max_members) {
          // Roll the approval back rather than admitting past capacity.
          await db.execute(
            "UPDATE join_requests SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL, updated_at = ? WHERE id = ?",
            [now, requestId],
          );
          return createErrorResponse("FORBIDDEN", "Community is full", 403);
        }

        const req = await db.querySingle("SELECT user_id FROM join_requests WHERE id = ?", [requestId]);
        await upsertMembership(db, communityId, req.user_id);

        await db.execute(
          "INSERT INTO notifications (id, user_id, type, title, message, data, created_at) VALUES (?, ?, 'JOIN_APPROVED', 'Request approved', ?, ?, ?)",
          [
            db.uuid(),
            req.user_id,
            `You are now a member of ${community.name}`,
            JSON.stringify({ communityId }),
            now,
          ],
        );
        await notifyUserPush(env, req.user_id, "Request approved", `You are now a member of ${community.name}`);

        await recordAudit(
          db,
          { actorId: userId, action: "community.request.approve", resourceType: "join_request", resourceId: requestId, request },
          env,
        );
        return createResponse({ message: "Request approved" });
      } catch (error: any) {
        return authError(error) ?? createErrorResponse("INTERNAL_ERROR", "Failed to approve request", 500);
      }
    },
  },

  // Reject a pending join request.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/communities/([^/]+)/requests/([^/]+)/reject$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const parts = new URL(request.url).pathname.split("/");
        const communityId = parts[4];
        const requestId = parts[6];
        if (!communityId || !requestId) {
          return createErrorResponse("VALIDATION_ERROR", "Community and request IDs are required", 400);
        }

        const db = new Database(env);
        const community = await db.querySingle("SELECT id, name FROM communities WHERE id = ? AND status = 'active'", [communityId]);
        if (!community) return createErrorResponse("NOT_FOUND", "Community not found", 404);

        const membership = await activeMembership(db, communityId, userId);
        if (!membership || !isManager(membership.role)) {
          return createErrorResponse("FORBIDDEN", "Only community managers can review requests", 403);
        }

        const now = db.now();
        const claimed = await db.execute(
          "UPDATE join_requests SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ? AND community_id = ? AND status = 'pending'",
          [now, userId, now, requestId, communityId],
        );
        if ((claimed.meta?.changes ?? 0) === 0) {
          return createErrorResponse("CONFLICT", "Request was already reviewed", 409);
        }

        const req = await db.querySingle("SELECT user_id FROM join_requests WHERE id = ?", [requestId]);
        await db.execute(
          "INSERT INTO notifications (id, user_id, type, title, message, data, created_at) VALUES (?, ?, 'JOIN_REJECTED', 'Request declined', ?, ?, ?)",
          [
            db.uuid(),
            req.user_id,
            `Your request to join ${community.name} was declined`,
            JSON.stringify({ communityId }),
            now,
          ],
        );

        await recordAudit(
          db,
          { actorId: userId, action: "community.request.reject", resourceType: "join_request", resourceId: requestId, request },
          env,
        );
        return createResponse({ message: "Request rejected" });
      } catch (error: any) {
        return authError(error) ?? createErrorResponse("INTERNAL_ERROR", "Failed to reject request", 500);
      }
    },
  },

  // Owner changes a member's role (promote/demote moderator).
  {
    method: "POST",
    pattern: "^\\/api\\/v1/communities/([^/]+)/members/([^/]+)/role$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const parts = new URL(request.url).pathname.split("/");
        const communityId = parts[4];
        const targetId = parts[6];
        if (!communityId || !targetId) {
          return createErrorResponse("VALIDATION_ERROR", "Community and member IDs are required", 400);
        }

        const parsed = roleSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            parsed.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const community = await loadActiveCommunity(db, communityId);
        if (!community) return createErrorResponse("NOT_FOUND", "Community not found", 404);

        if (community.owner_id !== userId) {
          return createErrorResponse("FORBIDDEN", "Only the owner can change member roles", 403);
        }
        if (targetId === userId) {
          return createErrorResponse("BAD_REQUEST", "You cannot change your own role", 400);
        }

        const target = await activeMembership(db, communityId, targetId);
        if (!target) return createErrorResponse("NOT_FOUND", "Member not found", 404);
        if (target.role === "owner") {
          return createErrorResponse("FORBIDDEN", "The owner role cannot be changed", 403);
        }

        await db.execute(
          "UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ? AND status = 'active'",
          [parsed.data.role, communityId, targetId],
        );
        await recordAudit(
          db,
          {
            actorId: userId,
            action: "community.member.role",
            resourceType: "community_member",
            resourceId: targetId,
            metadata: { communityId, role: parsed.data.role },
            request,
          },
          env,
        );
        return createResponse({ message: `Member role set to ${parsed.data.role}` });
      } catch (error: any) {
        return authError(error) ?? createErrorResponse("INTERNAL_ERROR", "Failed to update role", 500);
      }
    },
  },

  // Owner or moderator removes a member.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/communities/([^/]+)/members/([^/]+)/remove$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const parts = new URL(request.url).pathname.split("/");
        const communityId = parts[4];
        const targetId = parts[6];
        if (!communityId || !targetId) {
          return createErrorResponse("VALIDATION_ERROR", "Community and member IDs are required", 400);
        }

        const db = new Database(env);
        const community = await loadActiveCommunity(db, communityId);
        if (!community) return createErrorResponse("NOT_FOUND", "Community not found", 404);

        const actor = await activeMembership(db, communityId, userId);
        if (!actor || !isManager(actor.role)) {
          return createErrorResponse("FORBIDDEN", "Only community managers can remove members", 403);
        }
        if (targetId === userId) {
          return createErrorResponse("BAD_REQUEST", "Use leave instead of removing yourself", 400);
        }

        const target = await activeMembership(db, communityId, targetId);
        if (!target) return createErrorResponse("NOT_FOUND", "Member not found", 404);
        if (target.role === "owner") {
          return createErrorResponse("FORBIDDEN", "The owner cannot be removed", 403);
        }
        // Moderators may remove plain members only; owners may remove anyone but the owner.
        if (actor.role === "moderator" && target.role !== "member") {
          return createErrorResponse("FORBIDDEN", "Moderators can only remove members", 403);
        }

        const now = db.now();
        await db.execute(
          "UPDATE community_members SET status = 'banned' WHERE community_id = ? AND user_id = ? AND status = 'active'",
          [communityId, targetId],
        );
        await db.execute(
          "INSERT INTO notifications (id, user_id, type, title, message, data, created_at) VALUES (?, ?, 'REMOVED_FROM_COMMUNITY', 'Membership ended', ?, ?, ?)",
          [
            db.uuid(),
            targetId,
            `You were removed from ${community.name}`,
            JSON.stringify({ communityId }),
            now,
          ],
        );
        await recordAudit(
          db,
          {
            actorId: userId,
            action: "community.member.remove",
            resourceType: "community_member",
            resourceId: targetId,
            metadata: { communityId },
            request,
          },
          env,
        );
        return createResponse({ message: "Member removed" });
      } catch (error: any) {
        return authError(error) ?? createErrorResponse("INTERNAL_ERROR", "Failed to remove member", 500);
      }
    },
  },

  // Owner rotates a leaked invite code.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/communities/([^/]+)/invite/regenerate$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const communityId = communityIdFrom(new URL(request.url).pathname);
        if (!communityId) return createErrorResponse("VALIDATION_ERROR", "Community ID is required", 400);

        const db = new Database(env);
        const community = await loadActiveCommunity(db, communityId);
        if (!community) return createErrorResponse("NOT_FOUND", "Community not found", 404);
        if (community.owner_id !== userId) {
          return createErrorResponse("FORBIDDEN", "Only the owner can regenerate the invite code", 403);
        }

        const inviteCode = generateInviteCode();
        await db.execute(
          "UPDATE communities SET invite_code = ?, updated_at = ? WHERE id = ?",
          [inviteCode, db.now(), communityId],
        );
        await recordAudit(
          db,
          { actorId: userId, action: "community.invite.regenerate", resourceType: "community", resourceId: communityId, request },
          env,
        );
        return createResponse({ message: "Invite code regenerated", inviteCode });
      } catch (error: any) {
        return authError(error) ?? createErrorResponse("INTERNAL_ERROR", "Failed to regenerate invite code", 500);
      }
    },
  },

  // Owner archives the community (soft delete).
  {
    method: "DELETE",
    pattern: "^\\/api\\/v1/communities/([^/]+)$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const communityId = communityIdFrom(new URL(request.url).pathname);
        if (!communityId) return createErrorResponse("VALIDATION_ERROR", "Community ID is required", 400);

        const db = new Database(env);
        const community = await loadActiveCommunity(db, communityId);
        if (!community) return createErrorResponse("NOT_FOUND", "Community not found", 404);
        if (community.owner_id !== userId) {
          return createErrorResponse("FORBIDDEN", "Only the owner can archive this community", 403);
        }

        const now = db.now();
        await db.batch([
          {
            sql: "UPDATE communities SET status = 'archived', updated_at = ? WHERE id = ? AND status = 'active'",
            params: [now, communityId],
          },
          {
            sql: "UPDATE videos SET status = 'archived', updated_at = ? WHERE community_id = ? AND status IN ('active', 'pending')",
            params: [now, communityId],
          },
          {
            sql: "UPDATE join_requests SET status = 'cancelled', updated_at = ? WHERE community_id = ? AND status = 'pending'",
            params: [now, communityId],
          },
        ]);

        const members = await db.query(
          "SELECT user_id FROM community_members WHERE community_id = ? AND status = 'active' AND user_id != ?",
          [communityId, userId],
        );
        for (const member of members.results as Array<{ user_id: string }>) {
          await db.execute(
            "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'COMMUNITY_ARCHIVED', 'Community archived', ?, ?)",
            [db.uuid(), member.user_id, `${community.name} was archived by its owner`, now],
          );
        }

        await recordAudit(
          db,
          { actorId: userId, action: "community.archive", resourceType: "community", resourceId: communityId, request },
          env,
        );
        return createResponse({ message: "Community archived" });
      } catch (error: any) {
        return authError(error) ?? createErrorResponse("INTERNAL_ERROR", "Failed to archive community", 500);
      }
    },
  },
];
