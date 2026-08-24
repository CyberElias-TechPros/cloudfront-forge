import type { Env } from "../types";
import { createLogger } from "../lib/logger";

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "meta/llama-3.1-8b-instruct";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const AI_SYSTEM_PROMPT =
  "You are LoopSquad AI, the assistant for LoopSquad — a fair, gamified sub-for-sub " +
  "growth platform for YouTube creator communities (think WhatsApp creator groups). " +
  "You help creators with growth strategy, engagement and watch-time best practices, " +
  "how the platform's review/queue/missions work, and constructive video feedback. " +
  "Be concise, practical, and supportive. Use plain language and short paragraphs. " +
  "Do not invent platform features that do not exist; if unsure, say so.";

export async function generateChatCompletion(messages: ChatMessage[], env: Env): Promise<string> {
  const logger = createLogger(env);
  const apiKey = env.AI_API_KEY;
  const model = env.AI_MODEL || DEFAULT_MODEL;

  if (!apiKey || apiKey === "placeholder") {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error("NVIDIA AI request failed", new Error(`Status ${res.status}: ${text.slice(0, 500)}`));
    throw new Error("AI_REQUEST_FAILED");
  }

  const data = (await res.json().catch(() => null)) as any;
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    logger.error("NVIDIA AI empty response", new Error(JSON.stringify(data).slice(0, 500)));
    throw new Error("AI_EMPTY_RESPONSE");
  }
  return content.trim();
}

export async function* generateChatCompletionStream(
  messages: ChatMessage[],
  env: Env,
): AsyncGenerator<string, void, unknown> {
  const logger = createLogger(env);
  const apiKey = env.AI_API_KEY;
  const model = env.AI_MODEL || DEFAULT_MODEL;

  if (!apiKey || apiKey === "placeholder") {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error("NVIDIA AI stream failed", new Error(`Status ${res.status}: ${text.slice(0, 500)}`));
    throw new Error("AI_REQUEST_FAILED");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("AI_EMPTY_RESPONSE");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // partial JSON — skip
      }
    }
  }
}
