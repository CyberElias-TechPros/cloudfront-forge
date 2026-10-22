/**
 * gamification endpoints — generated into the contract registry (PLAT-002).
 *
 * One entry per route in the router table; `tests/contract/openapi.test.ts` fails
 * if an entry does not match a real route, so these cannot drift.
 */
import type { EndpointContract } from "../contract-types";
import { dailyQuestListResponseSchema, creditsResponseSchema, xpResponseSchema, reputationResponseSchema, streaksResponseSchema, badgeListResponseSchema, leaderboardResponseSchema, dailyBonusResponseSchema } from "../schemas/views";

export const gamificationEndpoints: EndpointContract[] = [
  {
    route: { method: "GET", path: "/api/v1/daily-quests" },
    path: "/api/v1/daily-quests",
    operationId: "listDailyQuests",
    summary: "Today's quests and the caller's progress",
    tag: "Gamification",
    auth: "user",
    response: dailyQuestListResponseSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/credits" },
    path: "/api/v1/credits",
    operationId: "getCreditBalance",
    summary: "Credit balance and the 50 most recent transactions",
    tag: "Gamification",
    auth: "user",
    response: creditsResponseSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/xp" },
    path: "/api/v1/xp",
    operationId: "getXpProgress",
    summary: "XP total, level and progress to the next level",
    tag: "Gamification",
    auth: "user",
    response: xpResponseSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/reputation" },
    path: "/api/v1/reputation",
    operationId: "getReputation",
    summary: "Trust score and the events that moved it",
    tag: "Gamification",
    auth: "user",
    response: reputationResponseSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/streaks" },
    path: "/api/v1/streaks",
    operationId: "getStreaks",
    summary: "Current and longest daily streak",
    tag: "Gamification",
    auth: "user",
    response: streaksResponseSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/badges" },
    path: "/api/v1/badges",
    operationId: "listBadges",
    summary: "Badges the caller has earned",
    tag: "Gamification",
    auth: "user",
    response: badgeListResponseSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/leaderboards" },
    path: "/api/v1/leaderboards",
    operationId: "getLeaderboard",
    summary: "XP leaderboard, optionally by cohort",
    tag: "Gamification",
    auth: "user",
    response: leaderboardResponseSchema,
    query: [{ name: "timeframe", enum: ["weekly", "monthly", "all"], default: "weekly" },
      { name: "cohort", enum: ["rookie", "rising", "veteran"], description: "Omit for all cohorts." },
      { name: "limit", type: "integer" },
      { name: "offset", type: "integer" }],
  },
  {
    route: { method: "POST", path: "/api/v1/gamification/daily-bonus" },
    path: "/api/v1/gamification/daily-bonus",
    operationId: "claimDailyBonus",
    summary: "Claim the once-a-day login bonus",
    tag: "Gamification",
    auth: "user",
    response: dailyBonusResponseSchema,
    errors: ["CONFLICT"],
  },
];
