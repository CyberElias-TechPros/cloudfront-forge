/**
 * In-memory Cloudflare bindings for behavioural tests.
 *
 * D1 is backed by real SQLite with the production migrations applied, so
 * handler tests exercise the same SQL — including unique indexes, `ON CONFLICT`
 * upserts, CHECK constraints and foreign keys — that production runs.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Env } from "../../src/types";
import { openTestDatabase, type TestDatabase } from "./sqlite-driver";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

/** D1 returns plain objects; node:sqlite returns null-prototype rows. */
function plain<T>(row: unknown): T {
  return (row === null || row === undefined ? null : { ...(row as object) }) as T;
}

class Statement {
  constructor(
    private readonly sqlite: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): Statement {
    return new Statement(this.sqlite, this.sql, params);
  }

  async all(): Promise<{ results: unknown[]; success: boolean; meta: unknown }> {
    const rows = this.sqlite.prepare(this.sql).all(...(this.params as never[]));
    return { results: rows.map((row) => plain(row)), success: true, meta: { changes: 0 } };
  }

  async first(): Promise<unknown> {
    const row = this.sqlite.prepare(this.sql).get(...(this.params as never[]));
    return plain(row);
  }

  async raw(): Promise<unknown[]> {
    return this.sqlite.prepare(this.sql).all(...(this.params as never[])) as unknown[];
  }

  async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
    const info = this.sqlite.prepare(this.sql).run(...(this.params as never[]));
    return {
      success: true,
      meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) },
    };
  }
}

type AnyStatement = Statement & { sql?: string; params?: unknown[] };

function makeD1(sqlite: TestDatabase): D1Database {
  return {
    prepare(sql: string) {
      const statement = new Statement(sqlite, sql) as AnyStatement;
      statement.sql = sql;
      statement.params = [];
      return statement;
    },
    async batch(statements: AnyStatement[]) {
      sqlite.exec("BEGIN");
      try {
        for (const statement of statements) {
          sqlite.prepare(statement.sql as string).run(...((statement.params ?? []) as never[]));
        }
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
      return [];
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    async dump() {
      throw new Error("not implemented in tests");
    },
    async withSession() {
      throw new Error("not implemented in tests");
    },
  } as unknown as D1Database;
}

export interface TestDatabaseHandle {
  db: D1Database;
  sqlite: TestDatabase;
}

/** Create a D1 database with every migration applied, in file order. */
export function createTestDatabase(): TestDatabaseHandle {
  const sqlite = openTestDatabase();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    // Every migration is written to be re-runnable on an existing database.
    sqlite.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  return { db: makeD1(sqlite), sqlite };
}

class MemoryKV {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string, options?: { type?: string }): Promise<unknown> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    if (options?.type === "json") {
      try {
        return JSON.parse(entry.value);
      } catch {
        return null;
      }
    }
    return entry.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, {
      value,
      ...(options?.expirationTtl ? { expiresAt: Date.now() + options.expirationTtl * 1000 } : {}),
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(): Promise<{ keys: { name: string; expiration?: number }[] }> {
    return { keys: [...this.store.keys()].map((name) => ({ name })) };
  }
}

class MemoryR2 {
  private objects = new Map<string, { body: ArrayBuffer; contentType?: string }>();

  async put(
    key: string,
    body: ArrayBuffer | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void> {
    const buffer =
      typeof body === "string" ? Buffer.from(body).buffer.slice(0) : (body as ArrayBuffer);
    this.objects.set(key, { body: buffer, contentType: options?.httpMetadata?.contentType });
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      body: object.body as unknown as ReadableStream,
      size: object.body.byteLength,
      httpMetadata: { contentType: object.contentType ?? "application/octet-stream" },
      writeHttpMetadata(headers: Headers) {
        headers.set("content-type", object.contentType ?? "application/octet-stream");
      },
    } as unknown as R2ObjectBody;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

export interface TestEnv extends Env {
  sqlite: TestDatabase;
  /** Insert a user row directly and return the internal user id. */
  seedUser(firebaseUid?: string): string;
  /** Grant an admin role to a user id. */
  makeAdmin(userId: string, role?: "super_admin" | "admin" | "moderator"): void;
}

export function createTestEnv(overrides: Partial<Env> = {}): TestEnv {
  const { db, sqlite } = createTestDatabase();
  const env = {
    DB: db,
    KV_CACHE: new MemoryKV() as unknown as KVNamespace,
    ASSETS_BUCKET: new MemoryR2() as unknown as R2Bucket,
    FIREBASE_PROJECT_ID: "creator-loop-test",
    ENVIRONMENT: "development",
    CORS_ORIGINS: "http://localhost:3000",
    AI_PROVIDER: "nvidia",
    AI_MODEL: "meta/llama-3.1-8b-instruct",
    REQUIRED_WATCH_SEC: "180",
    DAILY_CLAIM_LIMIT: "10",
    WATCH_REWARD_XP: "10",
    WATCH_REWARD_CREDITS: "4",
    SUBSCRIBE_REWARD_XP: "0",
    SUBSCRIBE_REWARD_CREDITS: "0",
    COMMENT_REWARD_XP: "10",
    COMMENT_REWARD_CREDITS: "3",
    REVIEW_XP: "20",
    REVIEW_CREDITS: "5",
    REVIEW_HELPFUL_XP: "5",
    RATE_LIMIT_MAX_REQUESTS: "100000",
    RATE_LIMIT_WINDOW: "60",
    ...overrides,
    sqlite,
    seedUser(firebaseUid = `uid-${Math.random().toString(36).slice(2, 10)}`) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      sqlite
        .prepare(
          "INSERT INTO users (id, firebase_uid, email, email_verified, display_name, created_at, updated_at, last_active) VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
        )
        .run(id, firebaseUid, `${firebaseUid}@example.test`, `User ${firebaseUid}`, now, now, now);
      return id;
    },
    makeAdmin(userId: string, role: "super_admin" | "admin" | "moderator" = "admin") {
      sqlite
        .prepare(
          "INSERT OR REPLACE INTO admin_users (id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(crypto.randomUUID(), userId, role, new Date().toISOString());
    },
  } as unknown as TestEnv;

  return env;
}

/**
 * Request pre-authenticated with a development token.
 *
 * `src/services/firebase.ts` accepts the dev token only when
 * ENVIRONMENT === "development", which is what the test env sets.
 */
export function authRequest(url: string, firebaseUid: string, init: RequestInit = {}): Request {
  const token = Buffer.from(
    JSON.stringify({ uid: firebaseUid, email: `${firebaseUid}@example.test`, emailVerified: true }),
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(url, { ...init, headers });
}

export function jsonRequest(
  url: string,
  firebaseUid: string,
  method: string,
  body: unknown,
): Request {
  return authRequest(url, firebaseUid, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Multipart request pre-authenticated with a development token. */
export function formRequest(url: string, firebaseUid: string, form: FormData): Request {
  const request = authRequest(url, firebaseUid, { method: "POST", body: form });
  return request;
}

export async function readJson<T = any>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
