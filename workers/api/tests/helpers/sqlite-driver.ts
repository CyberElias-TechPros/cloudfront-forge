/**
 * A synchronous, in-memory SQLite for the test suite.
 *
 * The suite runs real SQL (all 30 migrations) so handlers are exercised against
 * the same indexes, CHECK constraints and upserts as production. Two drivers can
 * provide that, and which one is available depends on the Node version:
 *
 * - `node:sqlite` — built in from Node 22.5, no dependency.
 * - `node-sqlite3-wasm` — a WebAssembly build of SQLite that works on Node 20.
 *
 * CI still pins Node 20 (see docs/CI_WORKFLOW_UPDATE.md), so the wasm driver is
 * what keeps `npm test` green there. Both are configured identically —
 * foreign keys on — so the choice of driver cannot change a test result.
 */
import { createRequire } from "node:module";

export interface TestStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
}

export interface TestDatabase {
  exec(sql: string): void;
  prepare(sql: string): TestStatement;
}

interface Driver {
  name: string;
  open(location: string): TestDatabase;
}

const require_ = createRequire(import.meta.url);

function toChanges(value: unknown): number {
  return typeof value === "bigint" ? Number(value) : ((value as number) ?? 0);
}

/** Built-in driver, Node >= 22.5. Binds parameters positionally. */
function nodeSqliteDriver(): Driver {
  const DatabaseSync = require_("node:sqlite").DatabaseSync as new (location?: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
      run(...params: unknown[]): {
        changes?: number | bigint;
        lastInsertRowid?: number | bigint;
      };
    };
  };

  return {
    name: "node:sqlite",
    open(location) {
      const db = new DatabaseSync(location);
      db.exec("PRAGMA foreign_keys = ON");
      return {
        exec: (sql) => db.exec(sql),
        prepare: (sql) => {
          const statement = db.prepare(sql);
          return {
            all: (...params) => statement.all(...params) as unknown[],
            get: (...params) => statement.get(...params) as unknown,
            run: (...params) => {
              const info = statement.run(...params);
              return {
                changes: toChanges(info.changes),
                lastInsertRowid: toChanges(info.lastInsertRowid),
              };
            },
          };
        },
      };
    },
  };
}

/** Wasm driver for Node 20. Takes bound parameters as a single array. */
function wasmDriver(): Driver {
  const { Database } = require_("node-sqlite3-wasm") as {
    Database: new (location?: string) => {
      exec(sql: string): void;
      prepare(sql: string): {
        all(values?: unknown[]): unknown[];
        get(values?: unknown[]): unknown;
        run(values?: unknown[]): { changes: number; lastInsertRowid: number | bigint };
      };
    };
  };

  return {
    name: "node-sqlite3-wasm",
    open(location) {
      const db = new Database(location);
      db.exec("PRAGMA foreign_keys = ON");
      return {
        exec: (sql) => db.exec(sql),
        prepare: (sql) => {
          const statement = db.prepare(sql);
          return {
            all: (...params) => statement.all(params) as unknown[],
            get: (...params) => statement.get(params) as unknown,
            run: (...params) => {
              const info = statement.run(params);
              return {
                changes: toChanges(info.changes),
                lastInsertRowid: toChanges(info.lastInsertRowid),
              };
            },
          };
        },
      };
    },
  };
}

/**
 * Pick a driver. `SQLITE_DRIVER=wasm` forces the fallback so it can be verified
 * on a Node version that would otherwise use the built-in one.
 */
let driver: Driver | null = null;
function activeDriver(): Driver {
  if (driver) return driver;
  if (process.env.SQLITE_DRIVER !== "wasm") {
    try {
      driver = nodeSqliteDriver();
      return driver;
    } catch {
      // Node < 22.5 — fall through to the wasm build.
    }
  }
  driver = wasmDriver();
  return driver;
}

/** Which driver is in use (surfaced in test output when debugging). */
export function sqliteDriverName(): string {
  return activeDriver().name;
}

/** Open a database with foreign-key enforcement on, as D1 has. */
export function openTestDatabase(location = ":memory:"): TestDatabase {
  return activeDriver().open(location);
}
