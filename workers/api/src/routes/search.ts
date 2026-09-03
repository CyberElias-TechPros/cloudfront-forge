import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";

export const searchRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/v1/search",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAuth(request, env);
        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q")?.trim();

        if (!q || q.length < 2) {
          return createResponse({ communities: [], videos: [] });
        }

        const db = new Database(env);
        const searchTerm = `%${q}%`;

        const communitiesResult = await db.query(
          `SELECT id, name, description, slug, is_public, created_at
           FROM communities
           WHERE (name LIKE ? OR description LIKE ?) AND is_public = 1
           ORDER BY created_at DESC
           LIMIT 20`,
          [searchTerm, searchTerm],
        );

        const videosResult = await db.query(
          `SELECT v.id, v.title, v.youtube_url, v.thumbnail_url, v.duration_seconds,
                  u.display_name as creator_name
           FROM videos v
           LEFT JOIN users u ON v.user_id = u.id
           WHERE v.title LIKE ? AND v.status = 'active'
           ORDER BY v.created_at DESC
           LIMIT 20`,
          [searchTerm],
        );

        return createResponse({
          communities: communitiesResult.results,
          videos: videosResult.results,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Search failed", 500);
      }
    },
  },
];

export default searchRoutes;
