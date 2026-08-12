-- Extend reputation accounts with the fields the member profile exposes
ALTER TABLE reputation_accounts ADD COLUMN subscriptions_given INTEGER DEFAULT 0;
ALTER TABLE reputation_accounts ADD COLUMN subscriptions_received INTEGER DEFAULT 0;
ALTER TABLE reputation_accounts ADD COLUMN watch_minutes INTEGER DEFAULT 0;
