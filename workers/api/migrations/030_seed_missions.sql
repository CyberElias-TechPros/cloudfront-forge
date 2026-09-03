-- Starter mission catalogue.
--
-- Missions are admin-authored (POST /api/v1/missions, admin only) and nothing
-- seeds them, so a fresh database ships with an empty Missions screen and no
-- way for a member to earn their first XP outside of watching. These rows give
-- every deployment a working starting catalogue; admins can add more (or set
-- is_active = 0 to hide these) at any time.
--
-- Idempotent: safe to re-run, and safe on databases that already have missions.

INSERT OR IGNORE INTO missions
  (id, title, description, difficulty, xp_reward, credit_reward, time_estimate_minutes, is_active, valid_from, created_at, updated_at)
VALUES
  ('m1000000-0000-4000-8000-000000000001',
   'Watch three squad videos',
   'Open the queue and watch three videos end to end. Leave the tab focused — the timer pauses when you switch away.',
   'easy', 30, 10, 20, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('m1000000-0000-4000-8000-000000000002',
   'Leave two helpful reviews',
   'Complete two assigned reviews with a rating and at least two sentences of specific, actionable feedback.',
   'medium', 60, 20, 25, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('m1000000-0000-4000-8000-000000000003',
   'Submit a video for feedback',
   'Add one of your videos to the queue with a short note about what you want feedback on.',
   'easy', 25, 10, 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('m1000000-0000-4000-8000-000000000004',
   'Give feedback on a new creator',
   'Review a video from someone who joined in the last 7 days and welcome them to the squad.',
   'easy', 40, 15, 15, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('m1000000-0000-4000-8000-000000000005',
   'Connect your YouTube channel',
   'Link your YouTube account so watch time and subscriptions can be verified automatically.',
   'easy', 50, 20, 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('m1000000-0000-4000-8000-000000000006',
   'Complete a five-video loop',
   'Watch and comment on five different videos in a single day. Quality over speed.',
   'hard', 120, 40, 60, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
