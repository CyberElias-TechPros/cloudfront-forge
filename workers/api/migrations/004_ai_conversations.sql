-- AI conversation history for context continuity (LoopSquad AI assistant)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, created_at ASC);

-- Seed default peer-review questions so review forms are functional out of the box.
INSERT INTO review_questions (id, community_id, question_text, question_type, is_required, order_index)
SELECT '00000000-0000-0000-0000-000000000001', NULL, 'Did the creator watch the full video and engage genuinely (no skipping/muting)?', 'yes_no', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM review_questions WHERE id = '00000000-0000-0000-0000-000000000001');

INSERT INTO review_questions (id, community_id, question_text, question_type, is_required, order_index)
SELECT '00000000-0000-0000-0000-000000000002', NULL, 'Was the subscribed confirmation and comment genuine and relevant?', 'yes_no', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM review_questions WHERE id = '00000000-0000-0000-0000-000000000002');

INSERT INTO review_questions (id, community_id, question_text, question_type, is_required, order_index)
SELECT '00000000-0000-0000-0000-000000000003', NULL, 'Rate the overall quality and effort of the video (1-5).', 'rating', 1, 3
WHERE NOT EXISTS (SELECT 1 FROM review_questions WHERE id = '00000000-0000-0000-0000-000000000003');

INSERT INTO review_questions (id, community_id, question_text, question_type, is_required, order_index)
SELECT '00000000-0000-0000-0000-000000000004', NULL, 'What specific, actionable feedback would help this creator improve?', 'text', 0, 4
WHERE NOT EXISTS (SELECT 1 FROM review_questions WHERE id = '00000000-0000-0000-0000-000000000004');
