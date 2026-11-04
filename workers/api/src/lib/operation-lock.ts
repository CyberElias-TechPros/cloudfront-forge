import { Database } from "./database";

/** Atomic D1 lease. Callers must release in finally; expiry recovers a crashed isolate. */
export async function acquireOperationLock(db: Database, userId: string, operation: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.execute(
    `INSERT INTO mobile_operation_locks (user_id, operation, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id, operation) DO UPDATE SET expires_at = excluded.expires_at
     WHERE mobile_operation_locks.expires_at < excluded.expires_at - 120`,
    [userId, operation, now + 120],
  );
  return (result.meta?.changes ?? 0) === 1;
}
export async function releaseOperationLock(db: Database, userId: string, operation: string): Promise<void> {
  await db.execute("DELETE FROM mobile_operation_locks WHERE user_id = ? AND operation = ?", [userId, operation]);
}
