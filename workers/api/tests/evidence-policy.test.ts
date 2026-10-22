import { describe, it, expect } from "vitest";
import {
  evaluateWatchEvidence,
  evidenceSettings,
  applyPayoutShare,
} from "../src/lib/verification/policy";
import { createTestEnv } from "./helpers/test-env";
import type { EvidenceSettings } from "../src/lib/verification/policy";

const REQUIRED = 180;

function settings(overrides: Partial<EvidenceSettings> = {}): EvidenceSettings {
  return {
    mode: "legacy",
    selfReportShare: 0.5,
    requiredSeconds: REQUIRED,
    sessionsEnabled: false,
    ...overrides,
  };
}

describe("evidence policy — configuration", () => {
  it("defaults to legacy mode so existing deployments do not change behaviour", () => {
    const env = createTestEnv();
    expect(evidenceSettings(env, REQUIRED).mode).toBe("legacy");
  });

  it("reads the mode and clamped self-report share from the environment", () => {
    const env = createTestEnv();
    env.EVIDENCE_POLICY = "verified_only";
    env.EVIDENCE_SELF_REPORT_SHARE = "1.8";
    const parsed = evidenceSettings(env, REQUIRED);
    expect(parsed.mode).toBe("verified_only");
    // Values above 1 would let a weak claim pay more than a strong one.
    expect(parsed.selfReportShare).toBe(1);
  });

  it("falls back to legacy for unknown modes instead of failing open or closed", () => {
    const env = createTestEnv();
    env.EVIDENCE_POLICY = "yolo";
    expect(evidenceSettings(env, REQUIRED).mode).toBe("legacy");
  });

  it("treats missing or negative requirements as zero", () => {
    expect(evidenceSettings(createTestEnv(), -5).requiredSeconds).toBe(0);
  });
});

describe("evidence policy — strong evidence", () => {
  it("pays in full when the YouTube API verified enough watch time, even in verified_only", () => {
    const decision = evaluateWatchEvidence({
      youtubeVerifiedSeconds: 240,
      sessionVerifiedSeconds: 0,
      selfReportedSeconds: 5,
      settings: settings({ mode: "verified_only" }),
    });
    expect(decision.level).toBe("youtube_api");
    expect(decision.strong).toBe(true);
    expect(decision.pays).toBe(true);
    expect(decision.payoutShare).toBe(1);
    expect(decision.verifiedSeconds).toBe(240);
  });

  it("pays in full from a server-scored session when YouTube is unavailable", () => {
    const decision = evaluateWatchEvidence({
      youtubeVerifiedSeconds: 0,
      sessionVerifiedSeconds: 190,
      selfReportedSeconds: 900,
      settings: settings({ mode: "verified_only", sessionsEnabled: true }),
    });
    expect(decision.level).toBe("signed_session");
    expect(decision.pays).toBe(true);
    expect(decision.verifiedSeconds).toBe(190);
  });

  it("reports partial server evidence as strong but non-paying", () => {
    const decision = evaluateWatchEvidence({
      youtubeVerifiedSeconds: 60,
      sessionVerifiedSeconds: 0,
      selfReportedSeconds: 600,
      settings: settings({ mode: "legacy" }),
    });
    expect(decision.strong).toBe(true);
    expect(decision.meetsRequirement).toBe(false);
    expect(decision.pays).toBe(false);
    expect(decision.reason).toMatch(/60s \/ 180s/);
  });

  it("prefers the highest available evidence level when both are present", () => {
    const decision = evaluateWatchEvidence({
      youtubeVerifiedSeconds: 200,
      sessionVerifiedSeconds: 181,
      selfReportedSeconds: 0,
      settings: settings({ mode: "verified_only" }),
    });
    expect(decision.level).toBe("youtube_api");
    expect(decision.verifiedSeconds).toBe(200);
  });
});

describe("evidence policy — self-reported evidence by mode", () => {
  const base = {
    youtubeVerifiedSeconds: 0,
    sessionVerifiedSeconds: 0,
    selfReportedSeconds: 200,
  };

  it("legacy pays full value (backwards compatible)", () => {
    const decision = evaluateWatchEvidence({ ...base, settings: settings({ mode: "legacy" }) });
    expect(decision.level).toBe("self_report");
    expect(decision.strong).toBe(false);
    expect(decision.pays).toBe(true);
    expect(decision.payoutShare).toBe(1);
  });

  it("capped mode pays only the configured share", () => {
    const decision = evaluateWatchEvidence({
      ...base,
      settings: settings({ mode: "self_report_capped", selfReportShare: 0.5 }),
    });
    expect(decision.pays).toBe(true);
    expect(decision.payoutShare).toBe(0.5);
    expect(applyPayoutShare(10, decision.payoutShare)).toBe(5);
  });

  it("capped mode with a zero share pays nothing but still records the watch", () => {
    const decision = evaluateWatchEvidence({
      ...base,
      settings: settings({ mode: "self_report_capped", selfReportShare: 0 }),
    });
    expect(decision.pays).toBe(false);
    expect(decision.verifiedSeconds).toBe(200);
  });

  it("verified_only never pays self-reported time", () => {
    const decision = evaluateWatchEvidence({
      ...base,
      settings: settings({ mode: "verified_only" }),
    });
    expect(decision.level).toBe("self_report");
    expect(decision.meetsRequirement).toBe(true);
    expect(decision.pays).toBe(false);
    expect(decision.payoutShare).toBe(0);
    expect(decision.reason).toMatch(/server-verified/i);
  });

  it("no mode pays a claim below the requirement", () => {
    for (const mode of ["legacy", "self_report_capped", "verified_only"] as const) {
      const decision = evaluateWatchEvidence({
        youtubeVerifiedSeconds: 0,
        sessionVerifiedSeconds: 0,
        selfReportedSeconds: 30,
        settings: settings({ mode }),
      });
      expect(decision.pays).toBe(false);
    }
  });
});

describe("evidence policy — edge cases", () => {
  it("reports 'none' when nothing was measured", () => {
    const decision = evaluateWatchEvidence({
      youtubeVerifiedSeconds: 0,
      sessionVerifiedSeconds: 0,
      selfReportedSeconds: 0,
      settings: settings(),
    });
    expect(decision.level).toBe("none");
    expect(decision.pays).toBe(false);
  });

  it("ignores NaN and negative measurements instead of crediting them", () => {
    const decision = evaluateWatchEvidence({
      youtubeVerifiedSeconds: Number.NaN,
      sessionVerifiedSeconds: -100,
      selfReportedSeconds: Number.POSITIVE_INFINITY,
      settings: settings({ mode: "legacy" }),
    });
    expect(decision.level).toBe("none");
    expect(decision.pays).toBe(false);
    expect(decision.verifiedSeconds).toBe(0);
  });

  it("rounds shares down so a partial reward can never round up into a windfall", () => {
    expect(applyPayoutShare(10, 0.55)).toBe(5);
    expect(applyPayoutShare(4, 0.5)).toBe(2);
    expect(applyPayoutShare(0, 1)).toBe(0);
    expect(applyPayoutShare(10, 2)).toBe(10);
    expect(applyPayoutShare(10, -1)).toBe(0);
  });

  it("honours a zero requirement as 'paid when evidence exists'", () => {
    const zero = settings({ requiredSeconds: 0, mode: "verified_only" });
    const withSession = evaluateWatchEvidence({
      youtubeVerifiedSeconds: 0,
      sessionVerifiedSeconds: 1,
      selfReportedSeconds: 0,
      settings: zero,
    });
    const selfOnly = evaluateWatchEvidence({
      youtubeVerifiedSeconds: 0,
      sessionVerifiedSeconds: 0,
      selfReportedSeconds: 60,
      settings: zero,
    });
    expect(withSession.pays).toBe(true);
    // A zero requirement must not turn self-report into verified evidence.
    expect(selfOnly.pays).toBe(false);
  });
});
