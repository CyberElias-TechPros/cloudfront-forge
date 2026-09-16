-- Track whether the overdue-review notifications already went out.
--
-- The cron sweep marks reviews overdue after 48h, but previously nobody was
-- told and nothing was reassigned. The recovery sweep notifies once
-- (guarded by this flag) and then reassigns the review to another member.
ALTER TABLE reviews ADD COLUMN overdue_notified INTEGER DEFAULT 0;
