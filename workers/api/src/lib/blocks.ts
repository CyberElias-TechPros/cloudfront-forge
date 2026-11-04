/** Bidirectional UGC visibility. Bind the caller's internal user id twice. */
export function notBlockedSql(memberColumn: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(memberColumn)) throw new Error("Invalid block column");
  return `AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE
    (ub.blocker_id = ? AND ub.blocked_id = ${memberColumn}) OR
    (ub.blocked_id = ? AND ub.blocker_id = ${memberColumn}))`;
}
