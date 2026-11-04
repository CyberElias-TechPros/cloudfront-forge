-- Native Android: device push, Play Billing, consent, blocking and safe claim locks.
-- No purchase token or FCM token is stored in plaintext.
CREATE TABLE IF NOT EXISTS mobile_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  encrypted_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android' CHECK (platform = 'android'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, installation_id)
);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices(user_id);

CREATE TABLE IF NOT EXISTS play_purchases (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_play_purchases_user ON play_purchases(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_play_credit_ledger
  ON credit_transactions(user_id, reference_id) WHERE type = 'bonus' AND reference_id LIKE 'play:%';

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_version TEXT NOT NULL,
  terms_accepted INTEGER NOT NULL CHECK (terms_accepted = 1),
  privacy_accepted INTEGER NOT NULL CHECK (privacy_accepted = 1),
  age_confirmed INTEGER NOT NULL CHECK (age_confirmed = 1),
  created_at TEXT NOT NULL,
  UNIQUE(user_id, policy_version)
);

-- Serialise a member's reward claims across isolates. The row is a short lease,
-- not a transaction: a crashed isolate cannot lock the account forever.
CREATE TABLE IF NOT EXISTS mobile_operation_locks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, operation)
);
