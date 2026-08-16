import { describe, it, expect } from "vitest";
import { YouTubeService } from "../src/services/youtube";

describe("YouTubeService", () => {
  it("throws when OAuth is not configured", () => {
    const env = {
      YOUTUBE_OAUTH_CLIENT_ID: "",
      YOUTUBE_OAUTH_CLIENT_SECRET: "",
      YOUTUBE_OAUTH_REDIRECT_URI: "",
    } as any;
    const service = new YouTubeService(env);
    expect(() => service.getAuthUrl("state")).toThrow("YOUTUBE_OAUTH_NOT_CONFIGURED");
  });

  it("generates auth URL with correct parameters", () => {
    const env = {
      YOUTUBE_OAUTH_CLIENT_ID: "test-client-id",
      YOUTUBE_OAUTH_CLIENT_SECRET: "test-secret",
      YOUTUBE_OAUTH_REDIRECT_URI: "https://example.com/callback",
    } as any;
    const service = new YouTubeService(env);
    const url = service.getAuthUrl("test-state");
    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("state=test-state");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("youtube.readonly");
  });
});
