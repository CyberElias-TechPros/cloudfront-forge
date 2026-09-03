import type { Env } from "../types";
import type { Database } from "./database";
import { createLogger } from "./logger";

export interface AuditEntry {
  /** Internal user id of the actor (null for system/cron actions). */
  actorId: string | null;
  /** Dotted action name, e.g. "topup.approve". */
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  /** Small, non-sensitive context (amounts, status transitions, reasons). */
  metadata?: Record<string, unknown> | null;
  /** Present when the action came from an HTTP request. */
  request?: Request;
}

/**
 * Append an audit event.
 *
 * Audit logging is intentionally best-effort: a failure to record the event must
 * never fail the operation being audited (and must never hide the original
 * error), so failures are logged only. Sensitive values (tokens, passwords,
 * full payloads) must never be passed as metadata.
 */
export async function recordAudit(db: Database, entry: AuditEntry, env?: Env): Promise<void> {
  try {
    await db.execute(
      `INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        db.uuid(),
        entry.actorId,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.request ? clientIp(entry.request) : null,
        entry.request ? truncate(entry.request.headers.get("user-agent"), 300) : null,
        db.now(),
      ],
    );
  } catch (error) {
    createLogger(env as Env).error("Audit log write failed", error, {
      action: entry.action,
      resourceType: entry.resourceType ?? undefined,
      resourceId: entry.resourceId ?? undefined,
    });
  }
}

export function clientIp(request: Request): string | null {
  const forwarded =
    request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || null;
  const ip = forwarded?.split(",")[0]?.trim();
  return ip ? truncate(ip, 45) : null;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}
