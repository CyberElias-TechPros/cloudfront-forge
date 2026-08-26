import type { Env } from "../types";
import { createLogger } from "./logger";

export class Database {
  protected env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<{ results: T[]; success: boolean }> {
    const logger = createLogger(this.env);
    try {
      const stmt = this.env.DB.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
      return { results: (result.results ?? []) as T[], success: true };
    } catch (error) {
      logger.error("Database query error", error);
      return { results: [], success: false };
    }
  }

  async querySingle(sql: string, params: any[] = []): Promise<any | null> {
    const logger = createLogger(this.env);
    try {
      const stmt = this.env.DB.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).first() : await stmt.first();
      return result ?? null;
    } catch (error) {
      logger.error("Database query error", error);
      return null;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ success: boolean; meta?: any }> {
    const logger = createLogger(this.env);
    try {
      const stmt = this.env.DB.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).run() : await stmt.run();
      return { success: result.success, meta: result.meta };
    } catch (error) {
      logger.error("Database execute error", error);
      return { success: false };
    }
  }

  async batch(statements: { sql: string; params?: any[] }[]): Promise<boolean> {
    const logger = createLogger(this.env);
    try {
      const batch = statements.map((s) =>
        s.params && s.params.length > 0
          ? this.env.DB.prepare(s.sql).bind(...s.params)
          : this.env.DB.prepare(s.sql),
      );
      await this.env.DB.batch(batch);
      return true;
    } catch (error) {
      logger.error("Database batch error", error);
      return false;
    }
  }

  async transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    const tx = new TransactionDatabase(this.env);
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  uuid(): string {
    return crypto.randomUUID();
  }

  now(): string {
    return new Date().toISOString();
  }
}

class TransactionDatabase extends Database {
  private statements: { sql: string; params?: any[] }[] = [];

  constructor(env: Env) {
    super(env);
  }

  async execute(sql: string, params: any[] = []): Promise<{ success: boolean; meta?: any }> {
    this.statements.push({ sql, params });
    return { success: true };
  }

  async batch(statements: { sql: string; params?: any[] }[]): Promise<boolean> {
    this.statements.push(...statements);
    return true;
  }

  async commit(): Promise<void> {
    if (this.statements.length === 0) return;
    const batch = this.statements.map((s) =>
      s.params && s.params.length > 0
        ? this.env.DB.prepare(s.sql).bind(...s.params)
        : this.env.DB.prepare(s.sql),
    );
    await this.env.DB.batch(batch);
  }

  async rollback(): Promise<void> {
    this.statements = [];
  }
}

export function createDb(env: Env): Database {
  return new Database(env);
}
