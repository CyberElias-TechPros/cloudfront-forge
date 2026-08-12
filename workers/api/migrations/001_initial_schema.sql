-- Initial schema for CreatorLoop
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    firebase_uid TEXT UNIQUE NOT NULL,
    email TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    display_name TEXT,
    photo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    last_active DATETIME
);

-- Creator profiles
CREATE TABLE IF NOT EXISTS creator_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE REFERENCES users(id),
    bio TEXT,
    country TEXT,
    language TEXT,
    experience_level TEXT CHECK(experience_level IN ('beginner', 'intermediate', 'advanced')),
    niche TEXT,
    content_categories TEXT,
    goals TEXT,
    looking_for TEXT CHECK(looking_for IN ('collaboration', 'feedback', 'support', 'mentorship')),
    avatar_url TEXT,
    banner_url TEXT,
    public_profile BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- YouTube channels
CREATE TABLE IF NOT EXISTS youtube_channels (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    subscriber_count INTEGER,
    view_count INTEGER,
    video_count INTEGER,
    country TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, channel_id)
);

-- Communities
CREATE TABLE IF NOT EXISTS communities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    owner_id TEXT REFERENCES users(id),
    max_members INTEGER DEFAULT 10000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Community members
CREATE TABLE IF NOT EXISTS community_members (
    id TEXT PRIMARY KEY,
    community_id TEXT REFERENCES communities(id),
    user_id TEXT REFERENCES users(id),
    role TEXT CHECK(role IN ('owner', 'admin', 'moderator', 'mentor', 'member')) DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('active', 'suspended', 'banned', 'left')) DEFAULT 'active',
    UNIQUE(community_id, user_id)
);

-- Community settings
CREATE TABLE IF NOT EXISTS community_settings (
    id TEXT PRIMARY KEY,
    community_id TEXT REFERENCES communities(id),
    allow_peer_review BOOLEAN DEFAULT TRUE,
    allow_collaboration BOOLEAN DEFAULT TRUE,
    require_approval BOOLEAN DEFAULT TRUE,
    default_language TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pods
CREATE TABLE IF NOT EXISTS pods (
    id TEXT PRIMARY KEY,
    community_id TEXT REFERENCES communities(id),
    name TEXT,
    description TEXT,
    max_size INTEGER DEFAULT 15,
    current_size INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    rotation_schedule TEXT CHECK(rotation_schedule IN ('daily', 'weekly', 'monthly')) DEFAULT 'weekly',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pod members
CREATE TABLE IF NOT EXISTS pod_members (
    id TEXT PRIMARY KEY,
    pod_id TEXT REFERENCES pods(id),
    user_id TEXT REFERENCES users(id),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    status TEXT CHECK(status IN ('active', 'inactive', 'removed')) DEFAULT 'active'
);

-- Videos
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    community_id TEXT REFERENCES communities(id),
    youtube_video_id TEXT,
    youtube_url TEXT,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    views_count INTEGER,
    likes_count INTEGER,
    published_at DATETIME,
    status TEXT CHECK(status IN ('pending', 'active', 'completed', 'archived', 'removed')) DEFAULT 'pending',
    watch_target INTEGER DEFAULT 20,
    min_watch_seconds INTEGER DEFAULT 180,
    give_take_ratio REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    video_id TEXT REFERENCES videos(id),
    reviewer_id TEXT REFERENCES users(id),
    submitter_id TEXT REFERENCES users(id),
    status TEXT CHECK(status IN ('assigned', 'in_progress', 'completed', 'overdue', 'skipped')) DEFAULT 'assigned',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    score INTEGER,
    feedback_text TEXT,
    watch_verified BOOLEAN DEFAULT FALSE,
    subscribed BOOLEAN DEFAULT FALSE,
    commented BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Review questions
CREATE TABLE IF NOT EXISTS review_questions (
    id TEXT PRIMARY KEY,
    community_id TEXT REFERENCES communities(id),
    question_text TEXT NOT NULL,
    question_type TEXT CHECK(question_type IN ('rating', 'text', 'yes_no')) DEFAULT 'rating',
    is_required BOOLEAN DEFAULT TRUE,
    order_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Review answers
CREATE TABLE IF NOT EXISTS review_answers (
    id TEXT PRIMARY KEY,
    review_id TEXT REFERENCES reviews(id),
    question_id TEXT REFERENCES review_questions(id),
    rating_value INTEGER,
    text_answer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Missions
CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
    xp_reward INTEGER DEFAULT 25,
    credit_reward INTEGER DEFAULT 10,
    time_estimate_minutes INTEGER DEFAULT 15,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    valid_to DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mission assignments
CREATE TABLE IF NOT EXISTS mission_assignments (
    id TEXT PRIMARY KEY,
    mission_id TEXT REFERENCES missions(id),
    user_id TEXT REFERENCES users(id),
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    status TEXT CHECK(status IN ('assigned', 'in_progress', 'completed', 'expired', 'skipped')) DEFAULT 'assigned'
);

-- Credit accounts
CREATE TABLE IF NOT EXISTS credit_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    balance INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Credit transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    amount INTEGER NOT NULL,
    type TEXT CHECK(type IN ('earned', 'spent', 'bonus', 'penalty', 'admin')) NOT NULL,
    description TEXT,
    reference_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- XP accounts
CREATE TABLE IF NOT EXISTS xp_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    xp_to_next_level INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- XP transactions
CREATE TABLE IF NOT EXISTS xp_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    amount INTEGER NOT NULL,
    type TEXT CHECK(type IN ('mission', 'challenge', 'review', 'feedback', 'login', 'bonus', 'penalty')) NOT NULL,
    description TEXT,
    reference_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reputation accounts
CREATE TABLE IF NOT EXISTS reputation_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    score INTEGER DEFAULT 100,
    last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reputation events
CREATE TABLE IF NOT EXISTS reputation_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    event_type TEXT NOT NULL,
    points_change INTEGER NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Streaks
CREATE TABLE IF NOT EXISTS streaks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date TEXT,
    streak_type TEXT CHECK(streak_type IN ('daily_login', 'daily_mission', 'daily_review')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    criteria_type TEXT NOT NULL,
    criteria_value TEXT,
    xp_reward INTEGER DEFAULT 0,
    credit_reward INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User badges
CREATE TABLE IF NOT EXISTS user_badges (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    badge_id TEXT REFERENCES badges(id),
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATETIME,
    end_date DATETIME,
    xp_reward INTEGER DEFAULT 100,
    credit_reward INTEGER DEFAULT 50,
    badge_id TEXT REFERENCES badges(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Challenge entries
CREATE TABLE IF NOT EXISTS challenge_entries (
    id TEXT PRIMARY KEY,
    challenge_id TEXT REFERENCES challenges(id),
    user_id TEXT REFERENCES users(id),
    entry_data TEXT,
    score INTEGER,
    rank INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Challenge votes
CREATE TABLE IF NOT EXISTS challenge_votes (
    id TEXT PRIMARY KEY,
    challenge_id TEXT REFERENCES challenges(id),
    voter_id TEXT REFERENCES users(id),
    entry_id TEXT REFERENCES challenge_entries(id),
    vote_value INTEGER CHECK(vote_value BETWEEN 1 AND 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(challenge_id, voter_id, entry_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT,
    message TEXT,
    data TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    whatsapp_enabled BOOLEAN DEFAULT FALSE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    mission_reminders BOOLEAN DEFAULT TRUE,
    review_requests BOOLEAN DEFAULT TRUE,
    community_updates BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT REFERENCES users(id),
    reported_user_id TEXT REFERENCES users(id),
    resource_type TEXT CHECK(resource_type IN ('video', 'review', 'comment', 'user', 'community')),
    resource_id TEXT,
    reason TEXT CHECK(reason IN ('spam', 'inappropriate', 'harassment', 'cheating', 'misleading', 'other')),
    description TEXT,
    status TEXT CHECK(status IN ('pending', 'investigating', 'resolved', 'dismissed')) DEFAULT 'pending',
    resolved_by TEXT REFERENCES users(id),
    resolution_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin users (for admin panel access)
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    role TEXT CHECK(role IN ('super_admin', 'admin', 'moderator')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_community_id ON videos(community_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_submitter_id ON reviews(submitter_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_video_id ON reviews(video_id);
CREATE INDEX IF NOT EXISTS idx_mission_assignments_user_id ON mission_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_mission_assignments_status ON mission_assignments(status);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);