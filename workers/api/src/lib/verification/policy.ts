/**
 * Watch-evidence policy (SEC-010).
 *
 * The product's promise is *verified* attention. Before this module, `POST
 * /watch` paid whenever the client said it had watched for long enough — the
 * signed-session subsystem existed but could not influence a payout.
 *
 * This module is the single place that decides what a claim's evidence is
 * worth. It is deliberately pure: the caller gathers the three measurements and
 * receives a decision, so every combination is unit-testable and the policy can
 * be replayed against historical claims.
 *
 * Evidence levels, strongest first:
 *
 * | Level            | Source                                   | Trust |
 * | ---------------- | ---------------------------------------- | ----- |
 * | `youtube_api`    | YouTube Data API watch-time verification  | High  |
 * | `signed_session` | Server-scored heartbeats in a signed session | High |
 * | `self_report`    | The client's own `watchSeconds`           | None  |
 * | `none`           | Nothing measurable                        | None  |
 *
 * Modes (`EVIDENCE_POLICY`):
 *
 * - `legacy` (default): self-reported time pays in full when no server-side
 *   evidence is available. This preserves pre-SEC-010 behaviour and is the only
 *   safe default until signed sessions are enabled and observed in production.
 * - `self_report_capped`: self-reported time pays a configurable share
 *   (`EVIDENCE_SELF_REPORT_SHARE`, default 0.5) so farming is less profitable
 *   while honest members on devices that cannot connect YouTube still earn.
 * - `verified_only`: only `youtube_api` or `signed_session` evidence pays.
 *   Self-reported time is still recorded (the member gets credit for the
 *   watch, and the loop still counts it) but earns nothing.
 *
 * Rollout order for `verified_only` is SEC-013: enable `WATCH_SESSIONS_ENABLED`
 * first, verify the strong-evidence share in the dashboard, then flip the mode.
 */
import type { Env } from "../../types";

export type EvidenceLevel = "youtube_api" | "signed_session" | "self_report" | "none";
export type EvidencePolicyMode = "legacy" | "self_report_capped" | "verified_only";

export interface EvidenceSettings {
  mode: EvidencePolicyMode;
  /** Share of the watch reward paid on self-reported evidence (capped mode). */
  selfReportShare: number;
  /** Seconds of verified watch time required before the watch component pays. */
  requiredSeconds: number;
  /** Whether signed watch sessions are enabled for this deployment. */
  sessionsEnabled: boolean;
}

export interface EvidenceInput {
  /** Seconds the YouTube API says were watched (0 when not connected/unavailable). */
  youtubeVerifiedSeconds: number;
  /** Seconds accepted by the heartbeat verifier for the presented session token. */
  sessionVerifiedSeconds: number;
  /** Seconds the client claims it watched. */
  selfReportedSeconds: number;
  settings: EvidenceSettings;
}

export interface EvidenceDecision {
  level: EvidenceLevel;
  /** True when the evidence is server-observed (youtube_api or signed_session). */
  strong: boolean;
  /** Server-observed seconds when available, else the self-reported value. */
  verifiedSeconds: number;
  /** Whether the best available evidence reaches `requiredSeconds`. */
  meetsRequirement: boolean;
  /** Whether the watch component may pay at all. */
  pays: boolean;
  /** Multiplier applied to the watch reward (1 = full, 0 = nothing). */
  payoutShare: number;
  /** Human-readable explanation, safe to return to the client. */
  reason: string;
}

export function sessionsEnabledFromEnv(env: Env): boolean {
  return env.WATCH_SESSIONS_ENABLED === "1" || env.WATCH_SESSIONS_ENABLED === "true";
}

function parseMode(raw: string | undefined): EvidencePolicyMode {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "verified_only" || value === "self_report_capped" || value === "legacy") {
    return value;
  }
  return "legacy";
}

/** Reads the policy configuration from the environment. */
export function evidenceSettings(env: Env, requiredSeconds: number): EvidenceSettings {
  const rawShare = Number.parseFloat(env.EVIDENCE_SELF_REPORT_SHARE ?? "");
  const selfReportShare = Number.isFinite(rawShare) ? Math.min(1, Math.max(0, rawShare)) : 0.5;

  return {
    mode: parseMode(env.EVIDENCE_POLICY),
    selfReportShare,
    requiredSeconds: Math.max(0, requiredSeconds),
    sessionsEnabled: sessionsEnabledFromEnv(env),
  };
}

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Decide what a claim's evidence is worth.
 *
 * Strong evidence always wins, and the strongest available level is reported so
 * dashboards can measure the mix. When no strong evidence exists, the mode
 * decides whether (and how much) self-reported time pays.
 */
export function evaluateWatchEvidence(input: EvidenceInput): EvidenceDecision {
  const { settings } = input;
  const youtube = positive(input.youtubeVerifiedSeconds);
  const session = positive(input.sessionVerifiedSeconds);
  const selfReported = positive(input.selfReportedSeconds);
  const required = settings.requiredSeconds;

  // With a zero requirement (no minimum configured) any server-observed second
  // is sufficient; the requirement never applies to *self-reported* evidence.
  const meets = (seconds: number) => (required > 0 ? seconds >= required : seconds > 0);

  const strongLevel: EvidenceLevel | null = meets(youtube)
    ? "youtube_api"
    : meets(session)
      ? "signed_session"
      : null;

  if (strongLevel) {
    const verifiedSeconds = Math.max(youtube, session);
    return {
      level: strongLevel,
      strong: true,
      verifiedSeconds,
      meetsRequirement: true,
      pays: true,
      payoutShare: 1,
      reason:
        strongLevel === "youtube_api"
          ? "Verified by the YouTube API"
          : "Verified by the server-scored watch session",
    };
  }

  // Partial strong evidence: report it (useful for progress UI) but it cannot
  // pay until it reaches the requirement.
  const partialSeconds = Math.max(youtube, session);
  if (partialSeconds > 0) {
    return {
      level: youtube >= session ? "youtube_api" : "signed_session",
      strong: true,
      verifiedSeconds: partialSeconds,
      meetsRequirement: false,
      pays: false,
      payoutShare: 0,
      reason:
        required > 0
          ? `Verified watch time not yet reached (${Math.round(partialSeconds)}s / ${required}s)`
          : "No verified watch time required",
    };
  }

  const selfMeets = meets(selfReported);

  switch (settings.mode) {
    case "verified_only":
      return {
        level: selfReported > 0 ? "self_report" : "none",
        strong: false,
        verifiedSeconds: selfReported,
        meetsRequirement: selfMeets,
        pays: false,
        payoutShare: 0,
        reason: selfMeets
          ? "Watch recorded, but this deployment only pays for server-verified attention (connect YouTube or watch in the app)"
          : "No server-verified watch time yet",
      };
    case "self_report_capped":
      return {
        level: selfReported > 0 ? "self_report" : "none",
        strong: false,
        verifiedSeconds: selfReported,
        meetsRequirement: selfMeets,
        pays: selfMeets && settings.selfReportShare > 0,
        payoutShare: selfMeets ? settings.selfReportShare : 0,
        reason: selfMeets
          ? `Self-reported watch time pays ${Math.round(settings.selfReportShare * 100)}% until verification is available`
          : "Watch time below the requirement",
      };
    case "legacy":
    default:
      return {
        level: selfReported > 0 ? "self_report" : "none",
        strong: false,
        verifiedSeconds: selfReported,
        meetsRequirement: selfMeets,
        pays: selfMeets,
        payoutShare: 1,
        reason: selfMeets
          ? "Self-reported watch time (verification not enforced)"
          : "Watch time below the requirement",
      };
  }
}

/** Apply a payout share to a reward component, rounding down (never overpay). */
export function applyPayoutShare(value: number, share: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const clamped = Math.min(1, Math.max(0, share));
  return Math.floor(value * clamped);
}
