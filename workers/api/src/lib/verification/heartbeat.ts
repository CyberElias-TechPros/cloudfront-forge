/**
 * Heartbeat integrity (SEC-012).
 *
 * A signed session only means something if the session's samples are scored
 * server-side. This module turns a stream of `(playerTime, receivedAt)` samples
 * into *accepted* watch seconds by rejecting the four cheap ways to fake watch
 * time:
 *
 * 1. **Rewind / replay** — player time must move forward (`playerDelta > 0`).
 * 2. **Fast-forward** — player time may not advance faster than wall-clock time
 *    times the playback rate plus jitter (`playerDelta <= wallDelta * MAX_RATE + JITTER`).
 * 3. **Gaps** — if the client disappears for longer than `MAX_GAP`, the gap is
 *    not credited (the member may have walked away with the tab in the
 *    background; only foreground samples count).
 * 4. **Impossible jumps** — a single sample may never credit more than `MAX_GAP`.
 *
 * The verifier is pure and deterministic so it can be tested exhaustively and
 * replayed against historical heartbeats.
 */

export interface HeartbeatSample {
  /** Player position in seconds. */
  playerTime: number;
  /** Server receive time in epoch seconds. */
  receivedAt: number;
}

export interface HeartbeatVerdict {
  accepted: boolean;
  /** Seconds credited by this sample (0 when rejected or when it is the baseline). */
  deltaSeconds: number;
  rejectReason?: "baseline" | "non_monotonic" | "rate_exceeded" | "gap_too_large" | "invalid";
}

export const HEARTBEAT_DEFAULTS = {
  /** Credited seconds may not exceed wall-clock seconds by more than this factor. */
  maxRate: 1.15,
  /** Two seconds of tolerance absorbs network jitter around sample boundaries. */
  jitterSeconds: 2,
  /** A sample more than this far from the previous one credits nothing. */
  maxGapSeconds: 120,
} as const;

export interface HeartbeatConfig {
  maxRate?: number;
  jitterSeconds?: number;
  maxGapSeconds?: number;
}

function clampConfig(config: HeartbeatConfig = {}) {
  return {
    maxRate: Math.max(1, config.maxRate ?? HEARTBEAT_DEFAULTS.maxRate),
    jitterSeconds: Math.max(0, config.jitterSeconds ?? HEARTBEAT_DEFAULTS.jitterSeconds),
    maxGapSeconds: Math.max(1, config.maxGapSeconds ?? HEARTBEAT_DEFAULTS.maxGapSeconds),
  };
}

/**
 * Score one sample against the previous accepted sample.
 *
 * The first sample of a session establishes the baseline: it is accepted for
 * bookkeeping but credits 0 seconds, because nothing about the member's
 * attention is known before it.
 */
export function scoreHeartbeat(
  previous: HeartbeatSample | null,
  current: HeartbeatSample,
  config: HeartbeatConfig = {},
): HeartbeatVerdict {
  const { maxRate, jitterSeconds, maxGapSeconds } = clampConfig(config);

  if (
    !Number.isFinite(current.playerTime) ||
    !Number.isFinite(current.receivedAt) ||
    current.playerTime < 0 ||
    current.receivedAt <= 0
  ) {
    return { accepted: false, deltaSeconds: 0, rejectReason: "invalid" };
  }

  if (!previous) {
    return { accepted: true, deltaSeconds: 0, rejectReason: "baseline" };
  }

  const wallDelta = current.receivedAt - previous.receivedAt;
  const playerDelta = current.playerTime - previous.playerTime;

  // Duplicate, out-of-order or rewound samples never credit time. (A rewind is
  // how a scripted client would try to re-earn the same seconds.)
  if (playerDelta <= 0) {
    return { accepted: false, deltaSeconds: 0, rejectReason: "non_monotonic" };
  }

  if (wallDelta <= 0) {
    // Two samples inside the same second: allow the sample but credit nothing.
    return { accepted: false, deltaSeconds: 0, rejectReason: "invalid" };
  }

  if (wallDelta > maxGapSeconds) {
    return { accepted: false, deltaSeconds: 0, rejectReason: "gap_too_large" };
  }

  const allowance = wallDelta * maxRate + jitterSeconds;
  if (playerDelta > allowance) {
    return { accepted: false, deltaSeconds: 0, rejectReason: "rate_exceeded" };
  }

  // Credit the real elapsed attention: never more than the player actually
  // advanced, the wall clock allows, or a single sample may carry.
  const credited = Math.min(playerDelta, wallDelta * maxRate, maxGapSeconds);
  return { accepted: true, deltaSeconds: Number(credited.toFixed(3)) };
}

/** Score a whole stream in order; returns per-sample verdicts and the total. */
export function scoreHeartbeatStream(
  samples: HeartbeatSample[],
  config: HeartbeatConfig = {},
): { verdicts: HeartbeatVerdict[]; verifiedSeconds: number; acceptedCount: number } {
  const verdicts: HeartbeatVerdict[] = [];
  let previousAccepted: HeartbeatSample | null = null;
  let verifiedSeconds = 0;
  let acceptedCount = 0;

  for (const sample of samples) {
    const verdict = scoreHeartbeat(previousAccepted, sample, config);
    verdicts.push(verdict);
    if (verdict.accepted) {
      acceptedCount += 1;
      verifiedSeconds += verdict.deltaSeconds;
      previousAccepted = sample;
    }
  }

  return { verdicts, verifiedSeconds: Number(verifiedSeconds.toFixed(3)), acceptedCount };
}
