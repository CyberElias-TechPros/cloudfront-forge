-- Claim verification fix: the daily bonus claim used a racy
-- check-then-insert on credit_transactions (two concurrent claims could
-- both pass the "no bonus today" check and both credit). last_daily_bonus_date
-- lets the claim be validated with a single conditional UPDATE, so exactly
-- one concurrent request can claim per user per day.
ALTER TABLE credit_accounts ADD COLUMN last_daily_bonus_date TEXT;
