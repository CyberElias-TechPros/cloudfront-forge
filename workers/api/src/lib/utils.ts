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
  let xpForCurrentLevel = 0;
  let xpForNextLevel = formatXPForLevel(level);

  while (xp >= xpForNextLevel) {
    level++;
    xpForCurrentLevel = xpForNextLevel;
    xpForNextLevel = formatXPForLevel(level);
  }

  return { level, xpToNextLevel: xpForNextLevel - xp };
}

export function calculateWeightedScore(xp: number, credits: number, reputation: number): number {
  return Math.round(xp * 0.4 + credits * 0.3 + reputation * 0.3);
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
