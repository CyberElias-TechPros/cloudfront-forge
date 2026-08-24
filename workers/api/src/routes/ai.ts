import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { generateChatCompletion, AI_SYSTEM_PROMPT, type ChatMessage } from "../services/ai";
import { createLogger } from "../lib/logger";

const HISTORY_LIMIT = 20;

/** Build a system prompt enriched with the user's real platform data. */
async function buildPlatformAwarePrompt(db: Database, userId: string): Promise<string> {
  // Fetch user profile + stats in parallel
  const [member, videos, xp, streaks, reviews] = await Promise.all([
    db.querySingle(
      "SELECT display_name, trust_score FROM users WHERE id = ?",
      [userId],
    ),
    db.query(
      `SELECT v.id, v.title, v.status, v.created_at,
              (SELECT COUNT(*) FROM watch_sessions w WHERE w.video_id = v.id AND w.status = 'claimed') as claims
       FROM videos v WHERE v.user_id = ? ORDER BY v.created_at DESC LIMIT 5`,
      [userId],
    ),
    db.querySingle("SELECT total_xp, level FROM xp_accounts WHERE user_id = ?", [userId]),
    db.querySingle("SELECT current_streak, longest_streak FROM streaks WHERE user_id = ? AND streak_type = 'daily_login'", [userId]),
    db.querySingle(
      "SELECT COUNT(*) as count FROM reviews WHERE reviewer_id = ? AND status = 'completed'",
      [userId],
    ),
  ]);

  const m = member as any;
  const x = xp as any;
  const s = streaks as any;
  const videoList = (videos.results ?? [])
    .map((v: any) => `- "${v.title}" (${v.status}, ${v.claims ?? 0} claims)`)
    .join("\n");

  return (
    AI_SYSTEM_PROMPT +
    `\n\n--- YOUR LIVE DATA (fetched fresh for this user) ---\n` +
    `Name: ${m?.display_name ?? "Creator"}\n` +
    `Trust score: ${m?.trust_score ?? "?"}/100\n` +
    `Level: ${x?.level ?? "?"} (${x?.total_xp ?? 0} XP)\n` +
    `Streak: ${s?.current_streak ?? 0} days (longest: ${s?.longest_streak ?? 0})\n` +
    `Reviews completed: ${reviews?.count ?? 0}\n` +
    `Recent videos:\n${videoList || "(none yet)"}\n` +
    `\nUse this data when answering questions about their account, videos, or growth. ` +
    `If they ask about features not listed in your instructions, say you don't have that info.`
  );
}

export const aiRoutes = [
  {
    method: "POST",
    path: "/api/v1/ai/chat",
    handler: async (request: Request, env: Env): Promise<Response> => {
      const logger = createLogger(env);
      try {
        const userId = await requireAuth(request, env);
        const rawBody = await request.json().catch(() => ({}));
        const body = rawBody as Record<string, unknown>;
        const message = typeof body.message === "string" ? body.message.trim() : undefined;
        const conversationId =
          typeof body.conversationId === "string" ? body.conversationId : undefined;

        if (!message) {
          return createErrorResponse("VALIDATION_ERROR", "Message is required", 400);
        }

        const db = new Database(env);
        const now = db.now();
        let convId = conversationId;

        if (convId) {
          const conv = await db.querySingle(
            "SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?",
            [convId, userId],
          );
          if (!conv) {
            return createErrorResponse("NOT_FOUND", "Conversation not found", 404);
          }
        } else {
          convId = db.uuid();
          await db.execute(
            "INSERT INTO ai_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            [convId, userId, message.slice(0, 60), now, now],
          );
        }

        // Load recent history for context continuity.
        const historyResult = await db.query(
          "SELECT role, content FROM ai_messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT ?",
          [convId, userId, HISTORY_LIMIT],
        );
        const history = (historyResult.results ?? []) as Array<{ role: string; content: string }>;

        const messages: ChatMessage[] = [
          { role: "system", content: await buildPlatformAwarePrompt(db, userId) },
          ...history.map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
          { role: "user", content: message },
        ];

        // --- Daily quota (per-user + global ceiling) ---
        const DAILY_USER_LIMIT = parseInt(env.AI_DAILY_USER_LIMIT || "20", 10);
        const DAILY_GLOBAL_LIMIT = parseInt(env.AI_DAILY_GLOBAL_LIMIT || "500", 10);
        const todayUserCount = await db.querySingle(
          "SELECT COUNT(*) as cnt FROM ai_messages WHERE user_id = ? AND role = 'user' AND created_at > datetime('now', 'start of day')",
          [userId],
        );
        if ((todayUserCount?.cnt ?? 0) >= DAILY_USER_LIMIT) {
          return createErrorResponse(
            "QUOTA_EXCEEDED",
            `Daily AI limit reached (${DAILY_USER_LIMIT} messages). Resets at midnight.`,
            429,
          );
        }
        if (DAILY_GLOBAL_LIMIT > 0) {
          const todayGlobal = await db.querySingle(
            "SELECT COUNT(*) as cnt FROM ai_messages WHERE role = 'user' AND created_at > datetime('now', 'start of day')",
          );
          if ((todayGlobal?.cnt ?? 0) >= DAILY_GLOBAL_LIMIT) {
            return createErrorResponse("QUOTA_EXCEEDED", "Daily AI capacity reached. Try again tomorrow.", 429);
          }
        }

        let reply: string;
        try {
          reply = await generateChatCompletion(messages, env);
        } catch (err: any) {
          if (err?.message === "AI_NOT_CONFIGURED") {
            return createErrorResponse(
              "AI_NOT_CONFIGURED",
              "AI is not configured on the server yet.",
              503,
            );
          }
          return createErrorResponse("AI_UNAVAILABLE", "AI service is unavailable.", 503);
        }

        // Persist both messages so future turns keep context.
        await db.batch([
          {
            sql: "INSERT INTO ai_messages (id, conversation_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            params: [db.uuid(), convId, userId, "user", message, now],
          },
          {
            sql: "INSERT INTO ai_messages (id, conversation_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            params: [db.uuid(), convId, userId, "assistant", reply, now],
          },
          {
            sql: "UPDATE ai_conversations SET updated_at = ? WHERE id = ?",
            params: [now, convId],
          },
        ]);

        return createResponse({
          conversationId: convId,
          reply,
          conversation: { id: convId, title: message.slice(0, 60) },
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        logger.error("AI chat error", error);
        return createErrorResponse("INTERNAL_ERROR", "Failed to process chat", 500);
      }
    },
  },
  {
    method: "GET",
    path: "/api/v1/ai/conversations",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const result = await db.query(
          "SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50",
          [userId],
        );
        return createResponse({ conversations: result.results ?? [] });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to list conversations", 500);
      }
    },
  },
  {
    method: "GET",
    pattern: "^\\/api\\/v1/ai/conversations/([^/]+)/messages$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const convId = url.pathname.split("/")[4];
        if (!convId) {
          return createErrorResponse("VALIDATION_ERROR", "Conversation ID is required", 400);
        }
        const db = new Database(env);
        const conv = await db.querySingle(
          "SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?",
          [convId, userId],
        );
        if (!conv) {
          return createErrorResponse("NOT_FOUND", "Conversation not found", 404);
        }
        const result = await db.query(
          "SELECT role, content, created_at FROM ai_messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC",
          [convId, userId],
        );
        return createResponse({ messages: result.results ?? [] });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to load messages", 500);
      }
    },
  },
  {
    method: "DELETE",
    pattern: "^\\/api\\/v1/ai/conversations/([^/]+)$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const convId = url.pathname.split("/").pop();
        if (!convId) {
          return createErrorResponse("VALIDATION_ERROR", "Conversation ID is required", 400);
        }
        const db = new Database(env);
        await db.execute("DELETE FROM ai_conversations WHERE id = ? AND user_id = ?", [
          convId,
          userId,
        ]);
        return createResponse({ message: "Conversation deleted" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to delete conversation", 500);
      }
    },
  },
];
