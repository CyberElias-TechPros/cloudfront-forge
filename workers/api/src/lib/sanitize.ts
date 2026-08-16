export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitize(input: string): string {
  const stripped = input.replace(/<[^>]*>/g, "");
  return sanitizeHtml(stripped);
}
