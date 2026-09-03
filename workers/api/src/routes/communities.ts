import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database, sqlBool } from "../lib/database";
import { generateInviteCode, generateSlug } from "../lib/utils";
import { sanitize } from "../lib/sanitize";
import { z } from "zod";
import { createLogger } from "../lib/logger";

function getPagination(request: Request): { limit: number; offset: number } {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  return { limit, offset };
}

const createCommunitySchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
  maxMembers: z.number().min(10).max(10000).default(10000),
});

const joinCommunitySchema = z.object({
  inviteCode: z.string().min(4).max(20),
});

const communitySettingsSchema = z.object({
  allowPeerReview: z.boolean().optional(),
  allowCollaboration: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  defaultLanguage: z.string().min(2).max(10).nullable().optional(),
});

export const communityRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/v1/communities",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const { limit, offset } = getPagination(request);

        const totalResult = await db.query(
          `SELECT COUNT(*) as count FROM communities c
           JOIN community_members cm ON c.id = cm.community_id
           WHERE cm.user_id = ? AND cm.status = 'active'`,
          [userId],
        );

        const result = await db.query(
          `
          SELECT c.* FROM communities c
          JOIN community_members cm ON c.id = cm.community_id
          WHERE cm.user_id = ? AND cm.status = 'active'
          ORDER BY cm.joined_at DESC
          LIMIT ? OFFSET ?
        `,
          [userId, limit, offset],
        );

        return createResponse({
          items: result.results,
          total: totalResult.results[0]?.count ?? 0,
          limit,
          offset,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch communities", 500);
      }
    },
  },

  {
    method: "GET",
    pattern: "^\\/api\\/v1/communities/([^/]+)$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      const logger = createLogger(env);
      try {
        const url = new URL(request.url);
        const communityId = url.pathname.split("/").pop();

        if (!communityId) {
          return createErrorResponse("VALIDATION_ERROR", "Community ID is required", 400);
        }

        const db = new Database(env);
        const userId = await requireAuth(request, env);
        const community = await db.querySingle("SELECT * FROM communities WHERE id = ?", [
          communityId,
        ]);

        if (!community) {
          return createErrorResponse("NOT_FOUND", "Community not found", 404);
        }

        const memberResult = await db.querySingle(
          "SELECT COUNT(*) as count FROM community_members WHERE community_id = ? AND status = 'active'",
          [communityId],
        );
        const memberCount = (memberResult?.count ?? 0) as number;

        const members = await db.query(
          "SELECT u.id, u.display_name, u.photo_url, cm.role, cm.joined_at FROM community_members cm JOIN users u ON cm.user_id = u.id WHERE cm.community_id = ? AND cm.status = 'active'",
          [communityId],
        );

        return createResponse({
          community: {
            id: community.id,
            name: community.name,
            description: community.description,
            slug: community.slug,
            isPublic: community.is_public,
            maxMembers: community.max_members,
            logoUrl: community.logo_url,
            bannerUrl: community.banner_url,
            createdAt: community.created_at,
            updatedAt: community.updated_at,
            memberCount,
            isOwner: community.owner_id === userId,
            inviteCode: community.invite_code,
          },
          members: members.results,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        logger.error("Get community error", error);
        return createErrorResponse("INTERNAL_ERROR", "Failed to get community", 500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/v1/communities",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;

        const validation = createCommunitySchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const now = new Date().toISOString();

        const communityId = db.uuid();
        const inviteCode = generateInviteCode();
        // Use the validated payload, not the raw body: `isPublic`/`maxMembers`
        // defaults live in the schema.
        const sanitizedName = sanitize(validation.data.name);
        const sanitizedDescription = validation.data.description
          ? sanitize(validation.data.description)
          : null;
        const slug = `${generateSlug(sanitizedName)}-${communityId.substring(0, 8)}`;

        await db.execute(
          `INSERT INTO communities (id, name, description, slug, invite_code, is_public, owner_id, max_members, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            communityId,
            sanitizedName,
            sanitizedDescription,
            slug,
            inviteCode,
            sqlBool(validation.data.isPublic) ?? 0,
            userId,
            validation.data.maxMembers ?? 10000,
            now,
            now,
          ],
        );

        await db.execute(
          "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, ?, ?, ?, ?, ?)",
          [db.uuid(), communityId, userId, "owner", now, "active"],
        );

        return createResponse({
          message: "Community created successfully",
          communityId,
          inviteCode,
          slug,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to create community", 500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/v1/communities/join",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;

        const validation = joinCommunitySchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const now = new Date().toISOString();

        const community = await db.querySingle("SELECT * FROM communities WHERE invite_code = ?", [
          body.inviteCode.toUpperCase(),
        ]);

        if (!community) {
          return createErrorResponse("NOT_FOUND", "Community not found with this invite code", 404);
        }

        const existingMember = await db.querySingle(
          "SELECT * FROM community_members WHERE community_id = ? AND user_id = ? AND status = 'active'",
          [community.id, userId],
        );

        if (existingMember) {
          return createErrorResponse("CONFLICT", "Already a member of this community", 409);
        }

        const memberCount = await db.querySingle(
          "SELECT COUNT(*) as count FROM community_members WHERE community_id = ? AND status = 'active'",
          [community.id],
        );

        if (memberCount && memberCount.count >= community.max_members) {
          return createErrorResponse("FORBIDDEN", "Community is full", 403);
        }

        await db.execute(
          "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, ?, ?, ?, ?, ?)",
          [db.uuid(), community.id, userId, "member", now, "active"],
        );

        return createResponse({
          message: "Joined community successfully",
          communityId: community.id,
          communityName: community.name,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to join community", 500);
      }
    },
  },

  {
    method: "GET",
    pattern: "^\\/api\\/v1/communities/([^/]+)/members$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const communityId = url.pathname.split("/")[4];
        if (!communityId) {
          return createErrorResponse("VALIDATION_ERROR", "Community ID is required", 400);
        }
        const db = new Database(env);

        // Private community rosters are for members only.
        const access = await db.querySingle(
          `SELECT c.is_public,
                  EXISTS (SELECT 1 FROM community_members m
                           WHERE m.community_id = c.id AND m.user_id = ? AND m.status = 'active') AS is_member
             FROM communities c WHERE c.id = ?`,
          [userId, communityId],
        );
        if (!access) {
          return createErrorResponse("NOT_FOUND", "Community not found", 404);
        }
        if (!access.is_public && !access.is_member) {
          return createErrorResponse(
            "FORBIDDEN",
            "Join this community to see its members",
            403,
          );
        }

        const result = await db.query(
          `SELECT cm.id, cm.role, cm.status, cm.joined_at, u.id as userId,
                  u.display_name as displayName, u.photo_url as photoUrl
           FROM community_members cm
           JOIN users u ON cm.user_id = u.id
           WHERE cm.community_id = ? AND cm.status = 'active'
           ORDER BY cm.joined_at ASC`,
          [communityId],
        );
        return createResponse({ members: result.results ?? [] });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch members", 500);
      }
    },
  },
  {
    method: "PUT",
    pattern: "^\\/api\\/v1/communities/([^/]+)/settings$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const communityId = url.pathname.split("/")[4];
        if (!communityId) {
          return createErrorResponse("VALIDATION_ERROR", "Community ID is required", 400);
        }
        const db = new Database(env);
        const community = await db.querySingle(
          "SELECT id FROM communities WHERE id = ? AND owner_id = ?",
          [communityId, userId],
        );
        if (!community) {
          return createErrorResponse(
            "FORBIDDEN",
            "Only the community owner can update settings",
            403,
          );
        }
        const parsed = communitySettingsSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            parsed.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        const now = db.now();
        const existing = await db.querySingle(
          "SELECT id FROM community_settings WHERE community_id = ?",
          [communityId],
        );
        const allowPeerReview = sqlBool(parsed.data.allowPeerReview) ?? 1;
        const allowCollaboration = sqlBool(parsed.data.allowCollaboration) ?? 1;
        const requireApproval = sqlBool(parsed.data.requireApproval) ?? 1;
        const defaultLanguage = parsed.data.defaultLanguage ?? null;
        if (existing) {
          await db.execute(
            `UPDATE community_settings
             SET allow_peer_review = ?, allow_collaboration = ?, require_approval = ?,
                 default_language = ?, updated_at = ?
             WHERE community_id = ?`,
            [
              allowPeerReview,
              allowCollaboration,
              requireApproval,
              defaultLanguage,
              now,
              communityId,
            ],
          );
        } else {
          await db.execute(
            `INSERT INTO community_settings
              (id, community_id, allow_peer_review, allow_collaboration, require_approval, default_language, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              db.uuid(),
              communityId,
              allowPeerReview,
              allowCollaboration,
              requireApproval,
              defaultLanguage,
              now,
              now,
            ],
          );
        }
        return createResponse({ message: "Settings updated" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to update settings", 500);
      }
    },
  },
];
