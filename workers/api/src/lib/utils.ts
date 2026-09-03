export { Database, createDb } from "./database";

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatXPForLevel(level: number): number {
  return Math.floor(50 * level * level * 0.8);
}

export function calculateLevel(xp: number): { level: number; xpToNextLevel: number } {
  let level = 1;
  let xpForNextLevel = formatXPForLevel(level);

  // Guard against a runaway loop if XP is ever NaN/Infinity.
  while (Number.isFinite(xp) && xp >= xpForNextLevel && level < 10_000) {
    level++;
    xpForNextLevel = formatXPForLevel(level);
  }

  return { level, xpToNextLevel: xpForNextLevel - xp };
}

const WATCH_TARGET_BUCKETS = [60, 90, 120, 150, 180];

/**
 * Deterministic per-video watch requirement.
 *
 * Real viewers watch different lengths; a single fixed requirement for every
 * video produces a suspiciously uniform engagement pattern. Derive a stable
 * target from the video id so every member sees the same requirement for a
 * given video, capped by the video's duration and the configured ceiling.
 */
export function resolveRequiredWatchSeconds(
  videoId: string,
  durationSeconds: number | null,
  defaultSec: number,
): number {
  let hash = 0;
  for (let i = 0; i < videoId.length; i++) {
    hash = (hash * 31 + videoId.charCodeAt(i)) % 997;
  }
  const base = WATCH_TARGET_BUCKETS[hash % WATCH_TARGET_BUCKETS.length] ?? defaultSec;
  const capped = durationSeconds && durationSeconds > 0 ? Math.min(base, durationSeconds) : base;
  return Math.max(30, Math.min(defaultSec, capped));
}

export function generateRequestId(): string {
  return crypto.randomUUID().split("-")[0] ?? "";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function camelize(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export function toCamelCaseKeys<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((item) => toCamelCaseKeys(item)) as unknown as T;
  }
  if (input !== null && typeof input === "object" && !(input instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[camelize(key)] = toCamelCaseKeys(value);
    }
    return result as T;
  }
  return input as T;
}
