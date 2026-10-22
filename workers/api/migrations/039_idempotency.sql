-- 039: Idempotent writes.
--
-- Mobile networks drop responses after the server has already committed. A
-- retried `POST /videos`, `/watch`, `/shop/purchase` or `/topups` would then
-- duplicate a submission or spend credits twice. Clients may now send an
-- `Idempotency-Key`; the outcome is stored for 24 hours and replayed verbatim
-- (PLAT-010).
--
-- `request_hash` guards against a caller reusing one key for a different
-- payload: that is a client bug, and answering it with the *first* response
-- would silently perform the wrong action, so it returns 409 instead.

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- Which endpoint the key belongs to: the same key may be used on two routes
  -- (a shared "operation id" in a client) without colliding.
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_keys_lookup
  ON idempotency_keys(user_id, scope, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expiry
  ON idempotency_keys(expires_at);
