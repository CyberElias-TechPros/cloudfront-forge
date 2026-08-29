import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";

const VALID_INTENTS = new Set(["collaboration", "feedback", "support", "mentorship"]);

/**
 * Creator discovery: list members who have opted into being found (public
 * profile) for a given intent (collaboration / feedback / support /
 * mentorship). Read-only; the profile's `looking_for` + `public_profile`
 * fields drive inclusion.
 */
export const discoverRoutes = [
  {
    method: "GET",
    path: "/api/v1/discover/collaborators",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAuth(request, env);
        const { searchParams } = new URL(request.url);
        const requested = searchParams.get("intent") ?? "collaboration";
        const intent = VALID_INTENTS.has(requested) ? requested : "collaboration";
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10)));

        const db = new Database(env);
        const result = await db.query(
          `SELECT u.id, u.display_name, u.photo_url, cp.niche, cp.experience_level, cp.goals, cp.looking_for
           FROM creator_profiles cp
           JOIN users u ON u.id = cp.user_id
           WHERE cp.public_profile = 1 AND cp.looking_for = ? AND u.deleted_at IS NULL
           ORDER BY u.created_at DESC LIMIT ?`,
          [intent, limit],
        );

        const members = result.results.map((m: any) => ({
          id: m.id,
          name: m.display_name ?? "Creator",
          avatar: m.photo_url ?? (m.display_name ?? "C").charAt(0).toUpperCase(),
          niche: m.niche ?? "Creator",
          experience: m.experience_level ?? null,
          goals: m.goals ?? null,
          intent: m.looking_for,
        }));

        return createResponse({ items: members, intent });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch creators", 500);
      }
    },
  },
];
