-- One ledger account per user.
-- The reward upserts use ON CONFLICT(user_id), which requires a UNIQUE
-- constraint on user_id. Without it every successful watch claim / review
-- reward failed with "ON CONFLICT clause does not match any PRIMARY KEY or
-- UNIQUE constraint". Merge any duplicate rows (keeping the most recently
-- updated row as the keeper) before enforcing uniqueness.

-- credit_accounts: merge balances into the keeper row, then drop duplicates
UPDATE credit_accounts
SET balance = (SELECT COALESCE(SUM(c2.balance), 0) FROM credit_accounts c2 WHERE c2.user_id = credit_accounts.user_id)
WHERE id IN (
  SELECT ca.id FROM credit_accounts ca
  WHERE ca.id = (
    SELECT x.id FROM credit_accounts x
    WHERE x.user_id = ca.user_id
    ORDER BY x.updated_at DESC, x.id DESC LIMIT 1
  )
);

DELETE FROM credit_accounts
WHERE id IN (
  SELECT ca.id FROM credit_accounts ca
  JOIN credit_accounts k ON k.user_id = ca.user_id
   AND (k.updated_at > ca.updated_at OR (k.updated_at = ca.updated_at AND k.id > ca.id))
);

-- xp_accounts: merge total XP into the keeper row, then drop duplicates
UPDATE xp_accounts
SET total_xp = (SELECT COALESCE(SUM(x2.total_xp), 0) FROM xp_accounts x2 WHERE x2.user_id = xp_accounts.user_id)
WHERE id IN (
  SELECT xa.id FROM xp_accounts xa
  WHERE xa.id = (
    SELECT x.id FROM xp_accounts x
    WHERE x.user_id = xa.user_id
    ORDER BY x.updated_at DESC, x.id DESC LIMIT 1
  )
);

DELETE FROM xp_accounts
WHERE id IN (
  SELECT xa.id FROM xp_accounts xa
  JOIN xp_accounts k ON k.user_id = xa.user_id
   AND (k.updated_at > xa.updated_at OR (k.updated_at = xa.updated_at AND k.id > xa.id))
);

-- reputation_accounts: score is a state (not a ledger) so keep the keeper's
-- score, but sum the activity counters; then drop duplicates
UPDATE reputation_accounts
SET subscriptions_given = (SELECT COALESCE(SUM(r2.subscriptions_given), 0) FROM reputation_accounts r2 WHERE r2.user_id = reputation_accounts.user_id),
    subscriptions_received = (SELECT COALESCE(SUM(r2.subscriptions_received), 0) FROM reputation_accounts r2 WHERE r2.user_id = reputation_accounts.user_id),
    watch_minutes = (SELECT COALESCE(SUM(r2.watch_minutes), 0) FROM reputation_accounts r2 WHERE r2.user_id = reputation_accounts.user_id)
WHERE id IN (
  SELECT ra.id FROM reputation_accounts ra
  WHERE ra.id = (
    SELECT x.id FROM reputation_accounts x
    WHERE x.user_id = ra.user_id
    ORDER BY x.updated_at DESC, x.id DESC LIMIT 1
  )
);

DELETE FROM reputation_accounts
WHERE id IN (
  SELECT ra.id FROM reputation_accounts ra
  JOIN reputation_accounts k ON k.user_id = ra.user_id
   AND (k.updated_at > ra.updated_at OR (k.updated_at = ra.updated_at AND k.id > ra.id))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_accounts_user ON credit_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_xp_accounts_user ON xp_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reputation_accounts_user ON reputation_accounts(user_id);
