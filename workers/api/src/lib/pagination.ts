/**
 * Cursor pagination (PLAT-016).
 *
 * Infinite scroll with `OFFSET` is subtly broken under writes: insert a row at
 * the top and everything shifts down, so the next page repeats an item (and the
 * page after that silently skips one). The user sees a duplicated card, or never
 * sees a post at all — the kind of bug nobody can reproduce.
 *
 * Keyset pagination fixes it by remembering *where* the last page ended instead
 * of *how many* rows came before: `(created_at, id) < (?, ?)`. Rows that move
 * because something was inserted no longer matter.
 *
 * The cursor is opaque to clients (base64url JSON) so the shape can evolve, but
 * it is **not** secret and **not** trusted: every value is re-validated and used
 * as a bound parameter, never interpolated into SQL.
 */

import { createErrorResponse } from "../middleware/errorHandler";

export interface PageParams {
  limit: number;
  /** Raw cursor from `?cursor=`; decoded by `decodeCursor`. */
  cursor: string | null;
  /**
   * `?offset=` from a client written before this existed. Honoured for one
   * release with `Deprecation`/`Sunset` headers, then removed.
   */
  offset: number | null;
}

export interface CursorValues {
  /** Ordered bound values matching the endpoint's sort columns. */
  k: Array<string | number>;
}

export class InvalidCursorError extends Error {
  constructor(message = "Invalid cursor") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** Legacy offset compatibility window, after which the parameter is an error. */
export const OFFSET_SUNSET = "Wed, 31 Dec 2026 23:59:59 GMT";

export function parsePageParams(
  request: Request,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): PageParams {
  const { searchParams } = new URL(request.url);
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;

  const rawLimit = parseInt(searchParams.get("limit") ?? String(defaultLimit), 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(maxLimit, Math.max(1, rawLimit))
    : defaultLimit;

  const cursor = searchParams.get("cursor");
  const rawOffset = searchParams.get("offset");
  const offset = rawOffset === null ? null : Math.max(0, parseInt(rawOffset, 10)) || 0;

  return { limit, cursor: cursor && cursor.trim() !== "" ? cursor : null, offset };
}

const CURSOR_VERSION = 1;

export function encodeCursor(values: CursorValues): string {
  const json = JSON.stringify({ v: CURSOR_VERSION, k: values.k });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCursor(raw: string): CursorValues {
  let parsed: unknown;
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InvalidCursorError("Cursor is not readable");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { v?: unknown }).v !== CURSOR_VERSION ||
    !Array.isArray((parsed as { k?: unknown }).k)
  ) {
    throw new InvalidCursorError("Cursor has an unexpected shape");
  }

  const values = (parsed as CursorValues).k;
  if (values.length === 0 || values.length > 4) {
    throw new InvalidCursorError("Cursor has an unexpected number of keys");
  }
  for (const value of values) {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new InvalidCursorError("Cursor values must be strings or numbers");
    }
  }

  return { k: values };
}

/**
 * SQL predicate for a keyset page.
 *
 * Descending example with two columns:
 * `(created_at < ? OR (created_at = ? AND id < ?))`, values `[a, a, b]`.
 * Equal columns are repeated so the comparison is a proper tuple comparison,
 * which SQLite can satisfy from an index.
 */
export function keysetPredicate(columns: string[], direction: "asc" | "desc" = "desc"): string {
  if (columns.length === 0) throw new Error("keysetPredicate needs at least one column");
  const operator = direction === "asc" ? ">" : "<";

  const build = (index: number): string => {
    const column = columns[index]!;
    const comparison = `${column} ${operator} ?`;
    if (index === columns.length - 1) return comparison;
    return `(${comparison} OR (${column} = ? AND ${build(index + 1)}))`;
  };

  return build(0);
}

/** Parameters for `keysetPredicate`, in matching order. */
export function keysetParams(values: Array<string | number>): Array<string | number> {
  if (values.length === 0) throw new Error("keysetParams needs at least one value");
  return values.flatMap((value, index) => (index === values.length - 1 ? [value] : [value, value]));
}

export interface PageInfo {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Build the page envelope. Always fetch `limit + 1` rows and pass them here:
 * that extra row is how `hasMore` is known without a second count query (and
 * without the count drifting from the page).
 */
export function buildPage<T>(
  rows: T[],
  limit: number,
  cursorValues: (row: T) => Array<string | number>,
): { items: T[]; pagination: PageInfo } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore && last !== undefined ? encodeCursor({ k: cursorValues(last) }) : null,
    },
  };
}

/**
 * Headers for a response that honoured the legacy `?offset=` parameter.
 *
 * `Deprecation` is the standard signal (RFC 9745); `Warning` and `Sunset` carry
 * the human-readable and concrete-date forms so both old and new tooling see it.
 */
export function deprecationHeaders(offset: number | null): Record<string, string> {
  if (offset === null) return {};
  return {
    Deprecation: "true",
    Sunset: OFFSET_SUNSET,
    Warning:
      "299 - \"The `offset` parameter is deprecated; use `cursor` from `pagination.nextCursor`\"",
  };
}

/**
 * Everything a list route needs, in one call.
 *
 * The route appends `clause` to its `WHERE`, spreads `params` before its
 * `LIMIT`, and fetches `fetchLimit` rows (one more than the page so `hasMore`
 * needs no count query).
 */
export interface PaginateOptions {
  /** Sort columns, most significant first; must match the `ORDER BY`. */
  columns: string[];
  direction?: "asc" | "desc";
  defaultLimit?: number;
  maxLimit?: number;
}

export interface Paginated {
  limit: number;
  fetchLimit: number;
  /** `AND (...)` when a cursor was supplied, otherwise an empty string. */
  clause: string;
  params: Array<string | number>;
  /** Row offset to apply (legacy `?offset=`), otherwise 0. */
  offset: number;
  /** True when the legacy offset was used, so the response can be marked deprecated. */
  isLegacyOffset: boolean;
  headers: Record<string, string>;
}

export function paginate(request: Request, options: PaginateOptions): Paginated {
  const page = parsePageParams(request, options);
  const cursor = page.cursor ? decodeCursor(page.cursor) : null;

  if (cursor && cursor.k.length !== options.columns.length) {
    throw new InvalidCursorError(
      `Cursor has ${cursor.k.length} keys; this endpoint expects ${options.columns.length}`,
    );
  }

  return {
    limit: page.limit,
    fetchLimit: page.limit + 1,
    clause: cursor ? `AND ${keysetPredicate(options.columns, options.direction)}` : "",
    params: cursor ? keysetParams(cursor.k) : [],
    offset: cursor ? 0 : (page.offset ?? 0),
    isLegacyOffset: !cursor && page.offset !== null,
    headers: !cursor ? deprecationHeaders(page.offset) : {},
  };
}

/**
 * Turn a bad cursor into a 400 rather than a 500.
 *
 * A cursor is opaque but not secret: clients persist it (localStorage, Android
 * SQLite) across releases, so a stale or edited value is *expected* input, not a
 * bug. Answering 500 sent people to support for something a reload fixes.
 */
export function cursorErrorResponse(
  error: unknown,
  message = "The pagination cursor is not valid; restart from the first page",
): Response | null {
  if (error instanceof InvalidCursorError) {
    return createErrorResponse("VALIDATION_ERROR", message, 400);
  }
  return null;
}
