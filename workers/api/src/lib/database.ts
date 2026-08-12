import type { Env } from "../types";

export class Database {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async query(sql: string, params: any[] = []): Promise<{ results: any[]; success: boolean }> {
    try {
      const stmt = this.env.DB.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
      return { results: result.results ?? [], success: true };
    } catch (error) {
      console.error("Database query error:", error);
      return { results: [], success: false };
    }
  }

  async querySingle(sql: string, params: any[] = []): Promise<any | null> {
    try {
      const stmt = this.env.DB.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).first() : await stmt.first();
      return result ?? null;
    } catch (error) {
      console.error("Database query error:", error);
      return null;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ success: boolean; meta?: any }> {
    try {
      const stmt = this.env.DB.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).run() : await stmt.run();
      return { success: result.success, meta: result.meta };
    } catch (error) {
      console.error("Database execute error:", error);
      return { success: false };
    }
  }

  async batch(statements: { sql: string; params?: any[] }[]): Promise<boolean> {
    try {
      const batch = statements.map((s) =>
        s.params && s.params.length > 0
          ? this.env.DB.prepare(s.sql).bind(...s.params)
          : this.env.DB.prepare(s.sql),
      );
      await this.env.DB.batch(batch);
      return true;
    } catch (error) {
      console.error("Database batch error:", error);
      return false;
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
