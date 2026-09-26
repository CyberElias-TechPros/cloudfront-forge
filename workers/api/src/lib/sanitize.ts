/**
 * Strip markup and control characters from user-supplied text before it is
 * stored.
 *
 * Deliberately does NOT HTML-escape: the value is rendered by React (which
 * escapes at render time) and returned as JSON to API clients. Escaping on the
 * way in produced double-escaped output — a display name of "R&D" was stored as
 * "R&amp;D" and then rendered literally as "R&amp;D".
 */
export function sanitize(input: string): string {
  return (
    input
      .replace(/<[^>]*>/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
  );
}

/**
 * Same stripping rules as `sanitize`, but line breaks survive — for text that
 * is written and read as a list (community rules, formatted guidance).
 * Carriage returns are normalised first so stored text is always separated
 * by `\n`.
 */
export function sanitizeMultiline(input: string): string {
  return (
    input
      .replace(/\r\n?/g, "\n")
      .replace(/<[^>]*>/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
      .trim()
  );
}
