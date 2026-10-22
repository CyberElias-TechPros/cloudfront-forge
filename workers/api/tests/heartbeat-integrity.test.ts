import { describe, it, expect } from "vitest";
import {
  scoreHeartbeat,
  scoreHeartbeatStream,
  HEARTBEAT_DEFAULTS,
} from "../src/lib/verification/heartbeat";

/** Build a stream of 30-second samples starting at t=0. */
function honestStream(minutes: number, startAt = 1_000_000) {
  const samples = [];
  for (let i = 0; i <= minutes * 2; i += 1) {
    samples.push({ playerTime: i * 30, receivedAt: startAt + i * 30 });
  }
  return samples;
}

describe("heartbeat integrity — honest playback", () => {
  it("credits real watch time at 1× playback", () => {
    const { verifiedSeconds, acceptedCount } = scoreHeartbeatStream(honestStream(3));
    // 6 samples after the baseline, 30s each.
    expect(acceptedCount).toBe(7);
    expect(verifiedSeconds).toBeCloseTo(180, 5);
  });

  it("treats the first sample as a baseline that credits nothing", () => {
    const verdict = scoreHeartbeat(undefined as never, { playerTime: 42, receivedAt: 1000 });
    expect(verdict.accepted).toBe(true);
    expect(verdict.deltaSeconds).toBe(0);
    expect(verdict.rejectReason).toBe("baseline");
  });

  it("tolerates network jitter around sample boundaries", () => {
    const verdict = scoreHeartbeat(
      { playerTime: 100, receivedAt: 1000 },
      { playerTime: 131, receivedAt: 1030 },
    );
    expect(verdict.accepted).toBe(true);
    expect(verdict.deltaSeconds).toBe(31);
  });
});

describe("heartbeat integrity — rejected streams", () => {
  it("rejects rewinds so the same seconds cannot be earned twice", () => {
    const verdict = scoreHeartbeat(
      { playerTime: 120, receivedAt: 1000 },
      { playerTime: 10, receivedAt: 1030 },
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.rejectReason).toBe("non_monotonic");
  });

  it("rejects duplicate samples", () => {
    const verdict = scoreHeartbeat(
      { playerTime: 120, receivedAt: 1000 },
      { playerTime: 120, receivedAt: 1030 },
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.rejectReason).toBe("non_monotonic");
  });

  it("rejects fast-forwarding beyond the rate allowance", () => {
    const verdict = scoreHeartbeat(
      { playerTime: 100, receivedAt: 1000 },
      { playerTime: 400, receivedAt: 1030 },
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.rejectReason).toBe("rate_exceeded");
  });

  it("credits nothing for a long gap (the member probably left)", () => {
    const verdict = scoreHeartbeat(
      { playerTime: 100, receivedAt: 1000 },
      { playerTime: 700, receivedAt: 1600 },
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.rejectReason).toBe("gap_too_large");
  });

  it("rejects samples that arrive at or before the previous timestamp", () => {
    const verdict = scoreHeartbeat(
      { playerTime: 100, receivedAt: 1000 },
      { playerTime: 130, receivedAt: 1000 },
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.rejectReason).toBe("invalid");
  });

  it("rejects impossible values instead of throwing", () => {
    for (const sample of [
      { playerTime: -1, receivedAt: 1000 },
      { playerTime: Number.NaN, receivedAt: 1000 },
      { playerTime: 10, receivedAt: 0 },
      { playerTime: Number.POSITIVE_INFINITY, receivedAt: 1000 },
    ]) {
      const verdict = scoreHeartbeat({ playerTime: 0, receivedAt: 999 }, sample);
      expect(verdict.accepted).toBe(false);
    }
  });
});

describe("heartbeat integrity — attack simulations", () => {
  it("a rewind loop earns far less than real playback of the same length", () => {
    const samples = [];
    const start = 1_000_000;
    // 6 minutes of wall clock, player time oscillating 0→120→0.
    for (let i = 0; i <= 12; i += 1) {
      samples.push({ playerTime: i % 2 === 0 ? 0 : 120, receivedAt: start + i * 30 });
    }
    const replay = scoreHeartbeatStream(samples);
    const honest = scoreHeartbeatStream(honestStream(6));

    expect(replay.verifiedSeconds).toBeLessThan(honest.verifiedSeconds / 4);
    expect(honest.verifiedSeconds).toBeGreaterThan(350);
  });

  it("a 10× speed-up stream is capped at wall-clock time", () => {
    const samples = [];
    const start = 1_000_000;
    for (let i = 0; i <= 10; i += 1) {
      samples.push({ playerTime: i * 300, receivedAt: start + i * 30 });
    }
    const { verifiedSeconds } = scoreHeartbeatStream(samples);
    // Every sample after the baseline is rejected for exceeding the rate.
    expect(verifiedSeconds).toBe(0);
  });

  it("a sparse 'tab in the background' stream credits almost nothing", () => {
    const samples = [
      { playerTime: 0, receivedAt: 1_000_000 },
      { playerTime: 600, receivedAt: 1_000_600 },
      { playerTime: 1200, receivedAt: 1_001_200 },
    ];
    const { verifiedSeconds, acceptedCount } = scoreHeartbeatStream(samples);
    expect(acceptedCount).toBe(1);
    expect(verifiedSeconds).toBe(0);
  });

  it("respects a custom gap configuration", () => {
    const strict = scoreHeartbeat(
      { playerTime: 0, receivedAt: 1000 },
      { playerTime: 45, receivedAt: 1045 },
      { maxGapSeconds: 30 },
    );
    expect(strict.accepted).toBe(false);
    expect(strict.rejectReason).toBe("gap_too_large");
  });

  it("never credits more than the configured maximum rate", () => {
    const { verifiedSeconds } = scoreHeartbeatStream(honestStream(10), { maxRate: 1.05 });
    // 30s of player time in 30s of wall clock is within 1.05×, so it still counts.
    expect(verifiedSeconds).toBeCloseTo(600, 0);
  });

  it("defaults are conservative", () => {
    expect(HEARTBEAT_DEFAULTS.maxRate).toBeGreaterThanOrEqual(1);
    expect(HEARTBEAT_DEFAULTS.maxGapSeconds).toBeLessThanOrEqual(300);
  });
});
