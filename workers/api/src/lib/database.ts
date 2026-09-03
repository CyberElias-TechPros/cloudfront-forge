import type { Env } from "../types";
import { createLogger } from "./logger";

/**
 * Raised when a D1 statement fails.
 *
 * The previous implementation swallowed every database error and returned an
 * empty result / `{ success: false }`. That turned broken SQL and missing
 * columns into "the user has no videos", "the ledger row was written" and other
 * silent data-loss class failures. Errors now propagate so the request fails
 * loudly (HTTP 500) instead of pretending the operation succeeded.
 */
/**
 * SQLite has no boolean type: values are stored as 0/1 integers and drivers
 * disagree about whether a JavaScript boolean may be bound directly (D1 and
 * node:sqlite do not), so every boolean has to go through here first.
 *
 * `undefined` / `null` stay null so `COALESCE(?, column)` keeps the current
 * value when a partial update omits the field.
 */
export function sqlBool(value: boolean | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value ? 1 : 0;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly sql?: string,
  ) {
    super(`DB_ERROR: ${message}`);
    this.name = "DatabaseError";
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Statement + bound parameters, executed together in one atomic D1 batch. */
export interface Statement {
  sql: string;
  params?: unknown[];
}

export class Database {
  protected env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<{ results: T[]; success: boolean }> {
    try {
      const stmt = this.env.DB.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
      return { results: (result.results ?? []) as T[], success: true };
    } catch (error) {
      createLogger(this.env).error("Database query error", error, { sql });
      throw new DatabaseError(describe(error), sql);
    }
  }

  async querySingle(sql: string, params: any[] = []): Promise<any | null> {
    try {
      const stmt = this.env.DB.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).first() : await stmt.first();
      return result ?? null;
    } catch (error) {
      createLogger(this.env).error("Database query error", error, { sql });
      throw new DatabaseError(describe(error), sql);
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ success: boolean; meta?: any }> {
    try {
      const stmt = this.env.DB.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).run() : await stmt.run();
      return { success: result.success, meta: result.meta };
    } catch (error) {
      createLogger(this.env).error("Database execute error", error, { sql });
      throw new DatabaseError(describe(error), sql);
    }
  }

  /**
   * Execute many statements in one atomic D1 batch.
   *
   * D1 batches are all-or-nothing, which is what the reward writers rely on to
   * keep XP/credit ledgers consistent. Callers that need "rows changed" must
   * inspect `meta.changes` of the individual statements.
   */
  async batch(statements: Statement[]): Promise<boolean> {
    if (statements.length === 0) return true;
    try {
      const batch = statements.map((s) =>
        s.params && s.params.length > 0
          ? this.env.DB.prepare(s.sql).bind(...s.params)
          : this.env.DB.prepare(s.sql),
      );
      await this.env.DB.batch(batch);
      return true;
    } catch (error) {
      createLogger(this.env).error("Database batch error", error, {
        statements: statements.map((s) => s.sql),
      });
      throw new DatabaseError(describe(error), statements[0]?.sql);
    }
  }

  uuid(): string {
    return crypto.randomUUID();
  }

  now(): string {
    return new Date().toISOString();
  }
}

export function createDb(env: Env): Database {
  return new Database(env);
}
