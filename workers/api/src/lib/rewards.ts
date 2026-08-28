import type { Env } from "../types";

export interface RewardComponent {
  xp: number;
  credits: number;
}

export interface RewardSplit {
  watch: RewardComponent;
  subscribe: RewardComponent;
  comment: RewardComponent;
  totalXp: number;
  totalCredits: number;
}

/**
 * Tiered engagement rewards.
 *
 * Watch, subscribe and comment each carry their own points so a member can
 * earn progressively — nothing is compulsory, but completing all three on a
 * video pays the full reward (30 XP / 10 credits by default). Values are
 * env-tunable so the economy can be rebalanced without a code change.
 */
export function getRewardSplit(env: Env): RewardSplit {
  const watch: RewardComponent = {
    xp: parseInt(env.WATCH_REWARD_XP || "10", 10),
    credits: parseInt(env.WATCH_REWARD_CREDITS || "4", 10),
  };
  const subscribe: RewardComponent = {
    xp: parseInt(env.SUBSCRIBE_REWARD_XP || "10", 10),
    credits: parseInt(env.SUBSCRIBE_REWARD_CREDITS || "3", 10),
  };
  const comment: RewardComponent = {
    xp: parseInt(env.COMMENT_REWARD_XP || "10", 10),
    credits: parseInt(env.COMMENT_REWARD_CREDITS || "3", 10),
  };

  return {
    watch,
    subscribe,
    comment,
    totalXp: watch.xp + subscribe.xp + comment.xp,
    totalCredits: watch.credits + subscribe.credits + comment.credits,
  };
}
