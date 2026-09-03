import { describe, it, expect, vi, afterEach } from "vitest";
import { aiRoutes } from "../src/routes/ai";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";
const chat = aiRoutes.find((r) => r.path === "/api/v1/ai/chat")!;
const stream = aiRoutes.find((r) => r.path === "/api/v1/ai/chat/stream")!;
const conversations = aiRoutes.find((r) => r.path === "/api/v1/ai/conversations")!;

async function body(response: Response) {
  return (await response.json()) as { data?: any; error?: { code: string } };
}

/** Minimal OpenAI-compatible chat completion response. */
function chatResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI chat", () => {
  it("reports a clear 503 when the provider key is missing", async () => {
    const env = createTestEnv();
    const uid = "asker-uid";
    env.seedUser(uid);
    const response = await chat.handler(
      jsonRequest(`${BASE}/api/v1/ai/chat`, uid, "POST", { message: "How do I grow?" }),
      env,
    );
    expect(response.status).toBe(503);
    expect((await body(response)).error?.code).toBe("AI_NOT_CONFIGURED");
  });

  it("posts to the base URL of the configured provider", async () => {
    const env = createTestEnv();
    env.AI_API_KEY = "test-key";
    env.AI_PROVIDER = "google";
    const uid = "asker-uid-2";
    env.seedUser(uid);

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return chatResponse("Post three times a week.");
      }),
    );

    const response = await chat.handler(
      jsonRequest(`${BASE}/api/v1/ai/chat`, uid, "POST", { message: "How often?" }),
      env,
    );
    expect(response.status).toBe(200);
    expect(calls[0]).toContain("generativelanguage.googleapis.com");
    expect((await body(response)).data.reply).toBe("Post three times a week.");
  });

  it("defaults to the NVIDIA endpoint", async () => {
    const env = createTestEnv();
    env.AI_API_KEY = "test-key";
    const uid = "asker-uid-3";
    env.seedUser(uid);

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return chatResponse("Sure.");
      }),
    );
    await chat.handler(jsonRequest(`${BASE}/api/v1/ai/chat`, uid, "POST", { message: "Hi" }), env);
    expect(calls[0]).toContain("integrate.api.nvidia.com");
  });

  it("persists both turns and keeps the conversation for the next message", async () => {
    const env = createTestEnv();
    env.AI_API_KEY = "test-key";
    const uid = "asker-uid-4";
    const user = env.seedUser(uid);
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse("Reply one")));

    const first = await body(
      await chat.handler(jsonRequest(`${BASE}/api/v1/ai/chat`, uid, "POST", { message: "One" }), env),
    );
    const conversationId = first.data.conversationId as string;

    vi.stubGlobal("fetch", vi.fn(async () => chatResponse("Reply two")));
    const second = await chat.handler(
      jsonRequest(`${BASE}/api/v1/ai/chat`, uid, "POST", { message: "Two", conversationId }),
      env,
    );
    expect(second.status).toBe(200);

    const messages = env.sqlite
      .prepare("SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at")
      .all(conversationId) as { role: string; content: string }[];
    expect(messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      "user:One",
      "assistant:Reply one",
      "user:Two",
      "assistant:Reply two",
    ]);

    const list = await body(
      await conversations.handler(authRequest(`${BASE}/api/v1/ai/conversations`, uid), env),
    );
    expect(list.data.conversations ?? list.data.items).toBeTruthy();
    expect(user).toBeTruthy();
  });

  it("refuses another member's conversation", async () => {
    const env = createTestEnv();
    env.AI_API_KEY = "test-key";
    const owner = env.seedUser("asker-uid-5");
    env.seedUser("intruder-uid");
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse("ok")));

    const first = await body(
      await chat.handler(
        jsonRequest(`${BASE}/api/v1/ai/chat`, "asker-uid-5", "POST", { message: "Mine" }),
        env,
      ),
    );
    const response = await chat.handler(
      jsonRequest(`${BASE}/api/v1/ai/chat`, "intruder-uid", "POST", {
        message: "Yours?",
        conversationId: first.data.conversationId,
      }),
      env,
    );
    expect(response.status).toBe(404);
    expect(owner).toBeTruthy();
  });

  it("enforces the daily per-user quota", async () => {
    const env = createTestEnv();
    env.AI_API_KEY = "test-key";
    env.AI_DAILY_USER_LIMIT = "2";
    const uid = "asker-uid-6";
    const user = env.seedUser(uid);
    vi.stubGlobal("fetch", vi.fn(async () => chatResponse("ok")));

    const now = new Date().toISOString();
    const convId = crypto.randomUUID();
    env.sqlite
      .prepare(
        "INSERT INTO ai_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, 'Earlier', ?, ?)",
      )
      .run(convId, user, now, now);
    const insert = env.sqlite.prepare(
      "INSERT INTO ai_messages (id, conversation_id, user_id, role, content, created_at) VALUES (?, ?, ?, 'user', 'x', ?)",
    );
    insert.run(crypto.randomUUID(), convId, user, now);
    insert.run(crypto.randomUUID(), convId, user, now);

    const response = await chat.handler(
      jsonRequest(`${BASE}/api/v1/ai/chat`, uid, "POST", { message: "One more" }),
      env,
    );
    expect(response.status).toBe(429);
    expect((await body(response)).error?.code).toBe("QUOTA_EXCEEDED");

    // The rejected attempt must not have created a second conversation.
    const convs = env.sqlite.prepare("SELECT COUNT(*) AS c FROM ai_conversations").get() as {
      c: number;
    };
    expect(convs.c).toBe(1);
  });

  it("requires a message", async () => {
    const env = createTestEnv();
    env.AI_API_KEY = "test-key";
    const uid = "asker-uid-7";
    env.seedUser(uid);
    const response = await chat.handler(
      jsonRequest(`${BASE}/api/v1/ai/chat`, uid, "POST", {}),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("surfaces provider failures as 503 AI_UNAVAILABLE", async () => {
    const env = createTestEnv();
    env.AI_API_KEY = "test-key";
    const uid = "asker-uid-8";
    env.seedUser(uid);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota exceeded", { status: 429 })));

    const response = await chat.handler(
      jsonRequest(`${BASE}/api/v1/ai/chat`, uid, "POST", { message: "Hi" }),
      env,
    );
    expect(response.status).toBe(503);
    expect((await body(response)).error?.code).toBe("AI_UNAVAILABLE");
  });

  it("streams SSE chunks and persists the full reply", async () => {
    const env = createTestEnv();
    env.AI_API_KEY = "test-key";
    const uid = "asker-uid-9";
    env.seedUser(uid);

    const sse =
      "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n" +
      "data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\n" +
      "data: [DONE]\n\n";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(sse, { status: 200 })),
    );

    const response = await stream.handler(
      jsonRequest(`${BASE}/api/v1/ai/chat/stream`, uid, "POST", { message: "Stream please" }),
      env,
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Hello");
    expect(text).toContain("[DONE]");

    await new Promise((resolve) => setTimeout(resolve, 20)); // let the stream finish persisting
    const assistant = env.sqlite
      .prepare("SELECT content FROM ai_messages WHERE role = 'assistant'")
      .all() as { content: string }[];
    expect(assistant.map((a) => a.content)).toContain("Hello world");
  });
});
