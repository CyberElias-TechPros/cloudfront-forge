import { describe, it, expect } from "vitest";
import {
  calculateLevel,
  formatXPForLevel,
  generateInviteCode,
  generateSlug,
  resolveRequiredWatchSeconds,
} from "../src/lib/utils";
import { calculateWeightedScore, SCORE_WEIGHTS, weightedScoreSql } from "../src/lib/scoring";
import { createTestEnv } from "./helpers/test-env";

describe("calculateLevel", () => {
  it("starts at level 1 and rises at the documented thresholds", () => {
    expect(calculateLevel(0)).toEqual({ level: 1, xpToNextLevel: 40 });
    expect(calculateLevel(39).level).toBe(1);
    expect(calculateLevel(40).level).toBe(2); // 50 * 1^2 * 0.8
    expect(calculateLevel(160).level).toBe(3); // 50 * 2^2 * 0.8
  });

  it("never regresses as XP grows", () => {
    let previous = 1;
    for (let xp = 0; xp < 20_000; xp += 137) {
      const { level } = calculateLevel(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it("keeps xpToNextLevel positive and shrinking within a level", () => {
    const first = calculateLevel(0);
    const midway = calculateLevel(20);
    expect(midway.xpToNextLevel).toBe(first.xpToNextLevel - 20);
    expect(midway.xpToNextLevel).toBeGreaterThan(0);
  });

  it("tolerates NaN / Infinity instead of hanging", () => {
    expect(calculateLevel(Number.NaN).level).toBe(1);
    expect(calculateLevel(Number.POSITIVE_INFINITY).level).toBe(1);
    expect(calculateLevel(-100).level).toBe(1);
  });

  it("matches the XP curve used everywhere else", () => {
    expect(formatXPForLevel(1)).toBe(40);
    expect(formatXPForLevel(10)).toBe(4000);
  });
});

describe("weighted score", () => {
  it("applies the published weights", () => {
    expect(calculateWeightedScore(100, 50, 20)).toBe(
      Math.round(100 * SCORE_WEIGHTS.xp + 50 * SCORE_WEIGHTS.credits + 20 * SCORE_WEIGHTS.reputation),
    );
    expect(calculateWeightedScore(1000, 0, 0)).toBe(400);
    expect(calculateWeightedScore(0, 0, 0)).toBe(0);
    expect(SCORE_WEIGHTS.xp + SCORE_WEIGHTS.credits + SCORE_WEIGHTS.reputation).toBeCloseTo(1, 10);
  });

  it("produces SQL that agrees with the TypeScript implementation", () => {
    const env = createTestEnv();
    const sql = weightedScoreSql("xp", "credits", "reputation");
    const rows = [
      [0, 0, 0],
      [10, 0, 0],
      [1234, 321, 55],
      [999999, 1, 7],
    ];
    for (const [xp, credits, reputation] of rows) {
      const row = env.sqlite
        .prepare(`SELECT ${sql} AS score FROM (SELECT ? AS xp, ? AS credits, ? AS reputation)`)
        .get(xp, credits, reputation) as { score: number };
      expect(row.score).toBe(calculateWeightedScore(xp!, credits!, reputation!));
    }
  });

  it("treats NULL columns as zero in SQL", () => {
    const env = createTestEnv();
    const row = env.sqlite
      .prepare(
        `SELECT ${weightedScoreSql("xp", "credits", "reputation")} AS score
         FROM (SELECT NULL AS xp, 100 AS credits, NULL AS reputation)`,
      )
      .get() as { score: number };
    expect(row.score).toBe(calculateWeightedScore(0, 100, 0));
  });
});

describe("resolveRequiredWatchSeconds", () => {
  it("is deterministic for a given video", () => {
    const a = resolveRequiredWatchSeconds("video-abc", 600, 120);
    const b = resolveRequiredWatchSeconds("video-abc", 600, 120);
    expect(a).toBe(b);
  });

  it("stays inside [30, configured maximum] and never exceeds the duration", () => {
    for (const id of ["a", "video-1", "zzz", "9f3c", "another-id", "x".repeat(40)]) {
      for (const duration of [null, 15, 45, 90, 600, 3600]) {
        const required = resolveRequiredWatchSeconds(id, duration, 120);
        expect(required).toBeGreaterThanOrEqual(30);
        expect(required).toBeLessThanOrEqual(120);
        if (duration && duration > 30) expect(required).toBeLessThanOrEqual(duration);
      }
    }
  });

  it("varies the requirement between videos", () => {
    const targets = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id) =>
        resolveRequiredWatchSeconds(id, 600, 180),
      ),
    );
    expect(targets.size).toBeGreaterThan(1);
  });
});

describe("helpers", () => {
  it("generates unambiguous invite codes", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateInviteCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/); // no I/O/0/1
    }
  });

  it("slugifies community names", () => {
    expect(generateSlug("Loop Squad!")).toBe("loop-squad");
    expect(generateSlug("  Á é  ")).toBe("");
    expect(generateSlug("Creator's Corner 2024")).toBe("creator-s-corner-2024");
  });
});
