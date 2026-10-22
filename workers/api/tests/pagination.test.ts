/**
 * PLAT-016 — cursor pagination.
 *
 * The bug being fixed is not "pages look wrong"; it is "pages *move*". A member
 * scrolls, someone inserts a row, and the next offset page repeats one item and
 * skips another. These tests insert between pages and assert that nothing is
 * duplicated or lost.
 */
import { describe, it, expect } from "vitest";
import {
  buildPage,
  decodeCursor,
  deprecationHeaders,
  encodeCursor,
  InvalidCursorError,
  keysetParams,
  keysetPredicate,
  paginate,
  parsePageParams,
} from "../src/lib/pagination";

describe("cursor encoding", () => {
  it("round-trips values", () => {
    const cursor = encodeCursor({ k: ["2026-10-22T10:00:00.000Z", "vid_123"] });
    expect(decodeCursor(cursor).k).toEqual(["2026-10-22T10:00:00.000Z", "vid_123"]);
  });

  it("is URL-safe", () => {
    const cursor = encodeCursor({ k: ["2026-10-22T10:00:00.000Z", "a+b/c==d"] });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor).k[1]).toBe("a+b/c==d");
  });

  it("rejects a cursor that is not ours", () => {
    expect(() => decodeCursor("not-a-cursor")).toThrow(InvalidCursorError);
    expect(() => decodeCursor(btoa(JSON.stringify({ v: 99, k: ["x"] })))).toThrow(
      InvalidCursorError,
    );
    expect(() => decodeCursor(btoa(JSON.stringify({ v: 1, k: [{ nested: true }] })))).toThrow(
      InvalidCursorError,
    );
  });

  it("refuses to build an unbounded keyset", () => {
    expect(() => keysetPredicate([])).toThrow();
    expect(() => keysetParams([])).toThrow();
  });
});

describe("keyset SQL", () => {
  it("compares tuples descending", () => {
    expect(keysetPredicate(["created_at", "id"])).toBe(
      "(created_at < ? OR (created_at = ? AND id < ?))",
    );
    expect(keysetParams(["t1", "v1"])).toEqual(["t1", "t1", "v1"]);
  });

  it("compares tuples ascending", () => {
    expect(keysetPredicate(["score", "id"], "asc")).toBe("(score > ? OR (score = ? AND id > ?))");
  });

  it("handles three sort keys", () => {
    expect(keysetPredicate(["a", "b", "c"])).toBe(
      "(a < ? OR (a = ? AND (b < ? OR (b = ? AND c < ?))))",
    );
    expect(keysetParams([1, 2, 3])).toEqual([1, 1, 2, 2, 3]);
  });
});

describe("request parsing", () => {
  const request = (query: string) => new Request(`https://api.test/api/v1/notifications${query}`);

  it("defaults and clamps the limit", () => {
    expect(parsePageParams(request("")).limit).toBe(20);
    expect(parsePageParams(request("?limit=0")).limit).toBe(1);
    expect(parsePageParams(request("?limit=10000")).limit).toBe(100);
    expect(parsePageParams(request("?limit=abc")).limit).toBe(20);
  });

  it("ignores a blank cursor", () => {
    expect(parsePageParams(request("?cursor=")).cursor).toBeNull();
    expect(parsePageParams(request("?cursor=%20")).cursor).toBeNull();
  });

  it("marks a legacy offset request for deprecation", () => {
    const page = paginate(request("?offset=40"), { columns: ["created_at", "id"] });
    expect(page.offset).toBe(40);
    expect(page.isLegacyOffset).toBe(true);
    expect(page.headers["Deprecation"]).toBe("true");
    expect(page.headers["Sunset"]).toContain("2026");
    expect(page.headers["Warning"]).toContain("cursor");
  });

  it("sends no deprecation header for cursor requests", () => {
    const cursor = encodeCursor({ k: ["2026-10-22T10:00:00.000Z", "abc"] });
    const page = paginate(request(`?cursor=${cursor}`), { columns: ["created_at", "id"] });
    expect(page.clause).toContain("created_at < ?");
    expect(page.params).toEqual(["2026-10-22T10:00:00.000Z", "2026-10-22T10:00:00.000Z", "abc"]);
    expect(page.offset).toBe(0);
    expect(deprecationHeaders(null)).toEqual({});
  });

  it("rejects a cursor from a different endpoint shape", () => {
    const wrongShape = encodeCursor({ k: ["only-one"] });
    expect(() => paginate(request(`?cursor=${wrongShape}`), { columns: ["a", "b"] })).toThrow(
      InvalidCursorError,
    );
  });
});

describe("page envelope", () => {
  interface Row {
    id: string;
    created_at: string;
  }
  const rows: Row[] = [
    { id: "c", created_at: "2026-10-22T12:00:00.000Z" },
    { id: "b", created_at: "2026-10-22T11:00:00.000Z" },
    { id: "a", created_at: "2026-10-22T10:00:00.000Z" },
  ];

  it("uses the fetched extra row to report hasMore", () => {
    const page = buildPage(rows, 2, (row) => [row.created_at, row.id]);
    expect(page.items.map((row) => row.id)).toEqual(["c", "b"]);
    expect(page.pagination.hasMore).toBe(true);
    expect(decodeCursor(page.pagination.nextCursor!).k).toEqual([rows[1]!.created_at, "b"]);
  });

  it("returns a null cursor on the last page", () => {
    const page = buildPage(rows.slice(0, 2), 2, (row) => [row.created_at, row.id]);
    expect(page.pagination.hasMore).toBe(false);
    expect(page.pagination.nextCursor).toBeNull();
  });

  it("handles an empty page without inventing a cursor", () => {
    const page = buildPage([], 20, (row: Row) => [row.created_at, row.id]);
    expect(page.items).toEqual([]);
    expect(page.pagination.nextCursor).toBeNull();
  });

  it("keeps pages stable when a row is inserted mid-scroll", () => {
    // Page 1 of a descending list.
    const first = buildPage(rows, 2, (row) => [row.created_at, row.id]);
    const seen = first.items.map((row) => row.id);

    // Someone posts: a newer row lands above everything already seen. With
    // OFFSET this would shift the window and repeat "b".
    const withInsert = [{ id: "d", created_at: "2026-10-22T13:00:00.000Z" }, ...rows];
    const cursor = decodeCursor(first.pagination.nextCursor!);
    const remaining = withInsert.filter(
      (row) =>
        row.created_at < String(cursor.k[0]) ||
        (row.created_at === String(cursor.k[0]) && row.id < String(cursor.k[1])),
    );

    expect(remaining.map((row) => row.id)).toEqual(["a"]);
    expect([...seen, ...remaining.map((row) => row.id)]).toEqual(["c", "b", "a"]);
  });
});

/**
 * End-to-end against real SQLite: the SQL predicates, the `LIMIT ?` placement
 * and the response envelope all have to line up, which unit tests cannot prove.
 */
describe("cursor pagination on GET /notifications", () => {
  const workerPromise = import("../src/index").then((module) => module.default);
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  it("walks the inbox without duplicates and honours the legacy offset", async () => {
    const worker = await workerPromise;
    const { createTestEnv, authRequest, readJson } = await import("./helpers/test-env");

    const env = createTestEnv();
    const uid = "uid-pager";
    const userId = env.seedUser(uid);
    const base = Date.parse("2026-10-22T12:00:00.000Z");

    for (let index = 0; index < 5; index += 1) {
      env.sqlite
        .prepare(
          "INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at) VALUES (?, ?, 'SYSTEM', ?, 'body', 0, ?)",
        )
        .run(
          `notif-${index}`,
          userId,
          `Notice ${index}`,
          new Date(base - index * 60_000).toISOString(),
        );
    }

    const call = (query: string) =>
      worker.fetch(authRequest(`https://api.test/api/v1/notifications${query}`, uid), env, ctx);

    const first = await call("?limit=2");
    const firstBody = await readJson<{
      data: { items: Array<{ id: string }>; nextCursor: string | null; hasMore: boolean };
    }>(first);
    expect(first.status).toBe(200);
    expect(firstBody.data.items.map((row) => row.id)).toEqual(["notif-0", "notif-1"]);
    expect(firstBody.data.hasMore).toBe(true);
    expect(firstBody.data.nextCursor).toBeTruthy();
    expect(first.headers.get("Deprecation")).toBeNull();

    // A notification arrives above the cursor while the member is scrolling.
    env.sqlite
      .prepare(
        "INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at) VALUES (?, ?, 'SYSTEM', 'Fresh', 'body', 0, ?)",
      )
      .run("notif-fresh", userId, new Date(base + 60_000).toISOString());

    const collected = [...firstBody.data.items.map((row) => row.id)];
    let cursor = firstBody.data.nextCursor;
    for (let guard = 0; cursor && guard < 10; guard += 1) {
      const next = await call(`?limit=2&cursor=${encodeURIComponent(cursor)}`);
      const body = await readJson<{
        data: { items: Array<{ id: string }>; nextCursor: string | null };
      }>(next);
      expect(next.status).toBe(200);
      collected.push(...body.data.items.map((row) => row.id));
      cursor = body.data.nextCursor;
    }

    // Nothing repeated, nothing skipped — the row inserted after page one is
    // simply not part of this scroll (it belongs to the top of a fresh one).
    expect(collected).toEqual(["notif-0", "notif-1", "notif-2", "notif-3", "notif-4"]);
    expect(new Set(collected).size).toBe(collected.length);

    // A client written before this shipped still works, and is told so.
    const legacy = await call("?limit=2&offset=4");
    const legacyBody = await readJson<{ data: { items: Array<{ id: string }> } }>(legacy);
    expect(legacy.headers.get("Deprecation")).toBe("true");
    // This is exactly why offset paging is deprecated: the row that arrived at
    // the top shifted the window, so the "last page" is now two rows.
    expect(legacyBody.data.items.map((row) => row.id)).toEqual(["notif-3", "notif-4"]);
  });

  it("rejects a tampered cursor with a validation error rather than a 500", async () => {
    const worker = await workerPromise;
    const { createTestEnv, authRequest, readJson } = await import("./helpers/test-env");

    const env = createTestEnv();
    const uid = "uid-badc";
    env.seedUser(uid);

    const response = await worker.fetch(
      authRequest("https://api.test/api/v1/notifications?cursor=garbage", uid),
      env,
      ctx,
    );
    expect(response.status).toBe(400);
    const body = await readJson<{ success: boolean; error: { code: string } }>(response);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
