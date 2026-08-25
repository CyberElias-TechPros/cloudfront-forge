-- Add give_take_ratio to reputation_accounts and computed view
ALTER TABLE reputation_accounts ADD COLUMN give_take_ratio REAL DEFAULT 1.0;

-- Function to calculate and update ratio
CREATE TRIGGER IF NOT EXISTS update_give_take_ratio
AFTER INSERT ON reputation_events
FOR EACH ROW
BEGIN
  UPDATE reputation_accounts
  SET give_take_ratio = CASE
    WHEN (subscriptions_received + 1) = 0 THEN 1.0
    ELSE (subscriptions_given * 1.0 + watch_minutes / 60.0) / (subscriptions_received + 1)
  END,
  updated_at = datetime('now')
  WHERE user_id = NEW.user_id;
END;