-- Review-of-review: submitters rate helpfulness; daily bonus with streak multiplier
ALTER TABLE reviews ADD COLUMN helpful INTEGER;

-- Notification preferences: quiet hours
ALTER TABLE notification_preferences ADD COLUMN quiet_hours_start INTEGER;
ALTER TABLE notification_preferences ADD COLUMN quiet_hours_end INTEGER;
