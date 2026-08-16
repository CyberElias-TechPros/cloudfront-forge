import type { Env } from "../types";
import { Database } from "../lib/database";

export interface YouTubeOAuthToken {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeChannelInfo {
  channelId: string;
  channelTitle: string;
  subscriberCount?: number;
}

export class YouTubeService {
  private db: Database;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.db = new Database(env);
  }

  getAuthUrl(state: string): string {
    const clientId = this.env.YOUTUBE_OAUTH_CLIENT_ID;
    const redirectUri = this.env.YOUTUBE_OAUTH_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new Error("YOUTUBE_OAUTH_NOT_CONFIGURED");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope:
        "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.analytics.readonly",
      access_type: "offline",
      state,
      prompt: "consent",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const clientId = this.env.YOUTUBE_OAUTH_CLIENT_ID;
    const clientSecret = this.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    const redirectUri = this.env.YOUTUBE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("YOUTUBE_OAUTH_NOT_CONFIGURED");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`YOUTUBE_TOKEN_EXCHANGE_FAILED: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const clientId = this.env.YOUTUBE_OAUTH_CLIENT_ID;
    const clientSecret = this.env.YOUTUBE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("YOUTUBE_OAUTH_NOT_CONFIGURED");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      throw new Error("YOUTUBE_TOKEN_REFRESH_FAILED");
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    return data.access_token;
  }

  async getValidAccessToken(userId: string): Promise<string | null> {
    const tokenRow = await this.db.querySingle(
      "SELECT * FROM youtube_oauth_tokens WHERE user_id = ?",
      [userId],
    );

    if (!tokenRow) return null;

    const now = new Date();
    const expiresAt = new Date(tokenRow.expires_at);
    const accessToken = tokenRow.access_token as string;
    const refreshToken = tokenRow.refresh_token as string | null;

    if (now >= expiresAt && refreshToken) {
      try {
        const newAccessToken = await this.refreshAccessToken(refreshToken);
        const newExpiresAt = new Date(now.getTime() + 3600 * 1000).toISOString();
        await this.db.execute(
          "UPDATE youtube_oauth_tokens SET access_token = ?, expires_at = ?, updated_at = ? WHERE user_id = ?",
          [newAccessToken, newExpiresAt, new Date().toISOString(), userId],
        );
        return newAccessToken;
      } catch {
        await this.db.execute("DELETE FROM youtube_oauth_tokens WHERE user_id = ?", [userId]);
        return null;
      }
    }

    return accessToken;
  }

  async saveTokens(
    userId: string,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    },
  ): Promise<void> {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    await this.db.execute(
      `INSERT INTO youtube_oauth_tokens (id, user_id, access_token, refresh_token, expires_at, scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      [
        crypto.randomUUID(),
        userId,
        tokens.accessToken,
        tokens.refreshToken,
        expiresAt,
        "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.analytics.readonly",
        now,
        now,
      ],
    );
  }

  async getChannelId(accessToken: string): Promise<string | null> {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { items?: Array<{ id: string }> };
    return data.items?.[0]?.id ?? null;
  }

  async isSubscribedTo(accessToken: string, channelId: string): Promise<boolean> {
    const myChannelId = await this.getChannelId(accessToken);
    if (!myChannelId || myChannelId === channelId) return false;

    let pageToken: string | undefined;
    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/subscriptions");
      url.searchParams.set("mine", "true");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("maxResults", "50");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return false;

      const data = (await response.json()) as {
        items?: Array<{ snippet: { resourceId: { channelId: string } } }>;
        nextPageToken?: string;
      };

      const subscribed = data.items?.some(
        (item) => item.snippet.resourceId.channelId === channelId,
      );
      if (subscribed) return true;

      pageToken = data.nextPageToken;
    } while (pageToken);

    return false;
  }

  async getWatchTime(accessToken: string, videoId: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const params = new URLSearchParams({
      ids: "channel==MINE",
      startDate: yesterday,
      endDate: today,
      metrics: "views,estimatedMinutesWatched",
      filters: `video==${videoId}`,
      dimensions: "video",
    });

    const response = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) return 0;

    const data = (await response.json()) as {
      rows?: Array<[string, number, number]>;
    };
    const row = data.rows?.[0];
    return row ? row[2] * 60 : 0;
  }
}
