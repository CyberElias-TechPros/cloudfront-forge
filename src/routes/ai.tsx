import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, Plus, Send, Sparkles, Trash2, User } from "lucide-react";
import { Shell, PageHeader } from "@/components/page-parts";
import { api } from "@/lib/api";
import { getIdToken } from "@/lib/firebase";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "LoopSquad AI — your growth assistant" },
      {
        name: "description",
        content:
          "Ask LoopSquad AI about growth strategy, watch-time best practices, and how the platform works. Conversations are saved so context carries over.",
      },
    ],
  }),
  component: AiAssistant,
});

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  created_at?: string;
}

export default function AiAssistant() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    try {
      const res = await api.get<{ conversations: Conversation[] }>("/api/v1/ai/conversations");
      setConversations(res.conversations ?? []);
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const openConversation = async (id: string) => {
    setActiveId(id);
    setMessages([]);
    setError(null);
    try {
      const res = await api.get<{ messages: ChatMessage[] }>(
        `/api/v1/ai/conversations/${id}/messages`,
      );
      setMessages(res.messages ?? []);
    } catch {
      setError("Could not load this conversation.");
    }
  };

  const startNew = () => {
    setActiveId(null);
    setMessages([]);
    setError(null);
  };

  const deleteConversation = async (id: string) => {
    try {
      await api.delete(`/api/v1/ai/conversations/${id}`);
      if (activeId === id) startNew();
      loadConversations();
    } catch {
      /* ignore */
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const optimistic: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(optimistic);
    setLoading(true);

    try {
      const token = await getIdToken();
      const res = await fetch(`${import.meta.env["VITE_API_URL"] ?? ""}/api/v1/ai/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          conversationId: activeId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errBody?.error?.message ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      setMessages([...optimistic, { role: "assistant", content: "" }]);

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
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              assistantContent += parsed.content;
              setMessages([...optimistic, { role: "assistant", content: assistantContent }]);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
              throw parseErr;
            }
          }
        }
      }

      setActiveId((prev) => {
        if (!prev) {
          // New conversation — reload sidebar
          loadConversations();
        }
        return prev;
      });
      loadConversations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(msg);
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <PageHeader
        eyebrow="LoopSquad AI"
        title="Growth assistant"
        description="Ask about growth strategy, watch-time best practices, and how the platform works. Your conversations are saved so context carries over between sessions."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="surface flex h-[70vh] flex-col p-3">
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            <Plus className="size-4" /> New chat
          </button>
          <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">No saved conversations yet.</p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={
                    "group flex items-center gap-2 rounded-md px-2 py-2 text-sm " +
                    (c.id === activeId
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60")
                  }
                >
                  <button
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className="flex flex-1 items-center gap-2 truncate text-left"
                  >
                    <MessageSquare className="size-4 shrink-0" />
                    <span className="truncate">{c.title || "Untitled chat"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConversation(c.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Chat panel */}
        <section className="surface flex h-[70vh] flex-col p-4">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <Sparkles className="size-8 text-accent" />
                <p className="mt-3 max-w-sm text-sm">
                  Start by asking something like “How do I grow my YouTube watch time organically?”
                  or “Explain how peer reviews work on LoopSquad.”
                </p>
              </div>
            ) : (
              messages
                .filter((m) => m.role !== "system")
                .map((m, i) => (
                  <div
                    key={i}
                    className={
                      "flex items-start gap-3 " + (m.role === "user" ? "flex-row-reverse" : "")
                    }
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-accent">
                      {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                    </span>
                    <div
                      className={
                        "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm " +
                        (m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground")
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))
            )}
          </div>

          {error ? (
            <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask LoopSquad AI…"
              className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </div>
        </section>
      </div>
    </Shell>
  );
}
