import { describe, it, expect } from "vitest";
import { topupRoutes, NGN_BANK_DETAILS, TOPUP_TIERS } from "../src/routes/topups";

describe("topup routes (NGN point purchases)", () => {
  it("exposes the NGN catalog endpoint", () => {
    const catalog = topupRoutes.find((r) => r.path === "/api/v1/topups" && r.method === "GET");
    expect(catalog).toBeDefined();
    expect(typeof catalog?.handler).toBe("function");
  });

  it("exposes the transfer submission endpoint", () => {
    const submit = topupRoutes.find((r) => r.path === "/api/v1/topups" && r.method === "POST");
    expect(submit).toBeDefined();
    expect(typeof submit?.handler).toBe("function");
  });

  it("exposes the proof-of-payment upload endpoint", () => {
    const proof = topupRoutes.find((r) => r.path === "/api/v1/topups/proof" && r.method === "POST");
    expect(proof).toBeDefined();
    expect(typeof proof?.handler).toBe("function");
  });

  it("exposes the admin proof-serving endpoint", () => {
    const proofServe = topupRoutes.find(
      (r) => r.method === "GET" && "pattern" in r && (r as any).pattern?.includes("proof"),
    );
    expect(proofServe).toBeDefined();
    expect(typeof proofServe?.handler).toBe("function");
  });

  it("exposes the user top-up history endpoint", () => {
    const mine = topupRoutes.find((r) => r.path === "/api/v1/topups/mine" && r.method === "GET");
    expect(mine).toBeDefined();
    expect(typeof mine?.handler).toBe("function");
  });

  it("exposes the admin queue and review endpoints", () => {
    const list = topupRoutes.find((r) => r.path === "/api/v1/admin/topups" && r.method === "GET");
    const approve = topupRoutes.find(
      (r) => "pattern" in r && (r as any).pattern?.includes("approve"),
    );
    const reject = topupRoutes.find(
      (r) => "pattern" in r && (r as any).pattern?.includes("reject"),
    );
    expect(list).toBeDefined();
    expect(typeof list?.handler).toBe("function");
    expect(typeof approve?.handler).toBe("function");
    expect(typeof reject?.handler).toBe("function");
  });

  it("ships the Moniepoint payout details", () => {
    expect(NGN_BANK_DETAILS.accountName).toBe("Delgra Ltd");
    expect(NGN_BANK_DETAILS.accountNumber).toBe("6674684361");
    expect(NGN_BANK_DETAILS.bankName).toBe("Moniepoint MFB");
  });

  it("offers monotonically increasing packs with volume bonuses", () => {
    let prevNgn = 0;
    let prevCredits = 0;
    for (const tier of TOPUP_TIERS) {
      expect(tier.ngn).toBeGreaterThan(prevNgn);
      expect(tier.credits).toBeGreaterThan(prevCredits);
      expect(tier.bonus).toBeGreaterThanOrEqual(0);
      expect(tier.credits).toBe(tier.ngn / 50 + tier.bonus);
      prevNgn = tier.ngn;
      prevCredits = tier.credits;
    }
  });
});
