/**
 * Leaderboard scoring.
 *
 * A single definition of the weights so the SQL that *sorts* the leaderboard
 * and the TypeScript that *reports* each row can never drift apart.
 */
export const SCORE_WEIGHTS = {
  xp: 0.4,
  credits: 0.3,
  reputation: 0.3,
} as const;

export function calculateWeightedScore(xp: number, credits: number, reputation: number): number {
  return Math.round(xp * SCORE_WEIGHTS.xp + credits * SCORE_WEIGHTS.credits + reputation * SCORE_WEIGHTS.reputation);
}

/**
 * SQL expression for the weighted score, using the same weights as
 * `calculateWeightedScore`. `xpExpr`, `creditsExpr` and `reputationExpr` are
 * column/expressions already in scope in the surrounding query.
 */
export function weightedScoreSql(xpExpr: string, creditsExpr: string, reputationExpr: string): string {
  return `ROUND(
    COALESCE(${xpExpr}, 0) * ${SCORE_WEIGHTS.xp}
    + COALESCE(${creditsExpr}, 0) * ${SCORE_WEIGHTS.credits}
    + COALESCE(${reputationExpr}, 0) * ${SCORE_WEIGHTS.reputation}
  )`;
}
