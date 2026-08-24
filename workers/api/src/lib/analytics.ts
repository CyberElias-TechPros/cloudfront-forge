import type { Env } from "../types";
import { Database } from "./database";

export type EventType =
  | "video_submitted"
  | "watch_started"
  | "watch_claimed"
  | "review_completed"
  | "report_filed"
  | "signup";

export async function trackEvent(
  env: Env,
  eventType: EventType,
  userId: string | null,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = new Database(env);
    await db.execute(
      `INSERT INTO analytics_events (id, user_id, event_type, resource_type, resource_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId,
        eventType,
        resourceType ?? null,
        resourceId ?? null,
        metadata ? JSON.stringify(metadata) : null,
        new Date().toISOString(),
      ],
    );
  } catch {
    // Never let analytics break the main flow
  }
}
