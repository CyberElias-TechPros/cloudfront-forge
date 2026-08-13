# CreatorLoop - Complete Build Plan from Scratch to Production

## Document Version: 1.0

## Date: August 11, 2026

## Author: AI Assistant (following detailed instructions)

## Status: In Progress

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Business Analysis](#2-business-analysis)
3. [Architecture Design](#3-architecture-design)
4. [Technology Stack](#4-technology-stack)
5. [Database Schema](#5-database-schema)
6. [API Design](#6-api-design)
7. [Gamification System](#7-gamification-system)
8. [Anti-Cheat & Verification](#8-anti-cheat--verification)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Backend Architecture](#10-backend-architecture)
11. [Development Phases](#11-development-phases)
12. [Detailed Implementation Steps](#12-detailed-implementation-steps)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment & CI/CD](#14-deployment--cicd)
15. [Monitoring & Operations](#15-monitoring--operations)
16. [Risk Assessment](#16-risk-assessment)
17. [Future Enhancements](#17-future-enhancements)
18. [Appendices](#appendices)

---

## 1. PROJECT OVERVIEW

### 1.1 Product Name

CreatorLoop

### 1.2 Tagline

> Create. Improve. Support. Collaborate. Grow.

### 1.3 Product Description

A gamified creator support and accountability platform that helps YouTube creators in WhatsApp groups coordinate their mutual growth efforts in a fair, transparent, and gamified way. The platform organizes creators into pods, assigns daily challenges and missions, tracks genuine community participation, and provides feedback mechanisms to ensure everyone contributes equally.

### 1.4 Mission Statement

To build a sustainable platform that transforms chaotic WhatsApp creator groups into structured, gamified communities where creators genuinely support each other's growth through authentic engagement, peer feedback, and collaborative learning — all while respecting YouTube's terms of service.

### 1.5 Target Audience

- Small to medium YouTube creators (100-50,000 subscribers)
- Creator coaches and community managers
- WhatsApp groups focused on mutual YouTube growth
- Creators seeking genuine feedback and collaboration

---

## 2. BUSINESS ANALYSIS

### 2.1 Problem Statement (From WhatsApp Chat Analysis)

After analyzing the WhatsApp conversation provided, the following core problems were identified:

1. **Discovery Problem**: No way to track which videos have been watched, which creators supported, or pending obligations
2. **Cheating Problem**: Members fear being taken advantage of; need accountability tracking
3. **Admin Overhead**: Manual reshuffling of 30 groups × 35 people daily becomes unsustainable
4. **Algorithm Risk**: YouTube's spam detection penalizes mass follow-for-follow behavior
5. **Quality Problem**: Need genuine watch time, not just mechanical subscriptions
6. **Coordination Problem**: No system to organize creators, assign tasks, track completion

### 2.2 Current State (as of August 11, 2026)

The project exists as a nearly empty repository:

- TanStack Start project with React, TypeScript, Vite
- Default UI components installed (Radix UI, Tailwind CSS, Lucide React, etc.)
- No application logic or features implemented
- Git repository initialized but no commits made
- AGENTS.md file contains Lovable platform instructions
- package.json has basic dependencies but no backend integration

### 2.3 Solution Approach

Rather than building a sub-for-sub automation tool (which violates YouTube's ToS), we build:

- A **Creator Accountability Platform** that gamifies genuine creator community participation
- **Creator Missions** instead of "watch and subscribe" tasks
- **Peer Feedback** systems instead of mechanical engagement
- **Credit Economy** where you must contribute to receive support
- **Pod Rotation** to prevent artificial engagement patterns

### 2.4 Key Features for MVP

| Priority | Feature             | Description                                           |
| -------- | ------------------- | ----------------------------------------------------- |
| P0       | User Authentication | Google OAuth via Firebase Auth                        |
| P0       | Creator Profile     | Basic profile with YouTube channel info               |
| P0       | Community System    | Private communities with invite codes                 |
| P0       | Pod System          | Small groups (10-20 members) of creators              |
| P0       | Mission Engine      | Daily tasks like "Give feedback on 2 videos"          |
| P0       | Peer Review         | Structured feedback system                            |
| P0       | Credit System       | Earn credits by contributing, spend to submit content |
| P0       | XP System           | Earn XP for platform participation                    |
| P0       | Streak System       | Daily participation streaks                           |
| P0       | Admin Dashboard     | Community management tools                            |
| P1       | Badge System        | Achievements for milestones                           |
| P1       | Reputation System   | Trust score based on quality                          |
| P1       | Leaderboards        | Community and pod rankings                            |

---

## 3. ARCHITECTURE DESIGN

### 3.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        INTERNET USERS                            │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     CLOUDFLARE      │
                    │   DNS / CDN / WAF   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   VERCEL (Frontend) │
                    │  React + Vite SPA   │
                    │   Hosted Static     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   CLOUDFLARE        │
                    │                     │
                    │  Workers (API)      │
                    │  ┌───────────────┐  │
                    │  │ API Routes    │  │
                    │  │ Auth          │  │
                    │  │ Business Logic│  │
                    │  │ Cron Jobs     │  │
                    │  └───────────────┘  │
                    └────┬──┬──┬──┬─────┘
                         │  │  │  │
                         ▼  ▼  ▼  ▼
                    ┌──────┐┌──┐┌─┐┌──────┐
                    │ D1   ││KV││R2││Queue│
                    │DB    ││Cach││Files││Jobs │
                    └──────┘└──┘└─┘└──────┘
                         │
                         ▼
                    ┌──────────────┐
                    │ Background   │
                    │ Workers      │
                    │ (AI, Email,  │
                    │  YouTube,    │
                    │  etc.)       │
                    └──────────────┘
                         │
                    ┌──────────────┐
                    │ External     │
                    │ Services:    │
                    │ Firebase     │
                    │ YouTube API  │
                    │ AI Provider  │
                    │ Email        │
                    └──────────────┘
```

### 3.2 Architecture Principles

1. **Frontend-Backend Separation**: Vercel handles static frontend, Cloudflare Workers handle all API logic
2. **Serverless First**: All compute is serverless for cost efficiency and automatic scaling
3. **Caching Strategy**: Aggressive caching with KV for frequently accessed data
4. **Event-Driven**: Queues for background processing to keep API responsive
5. **Multi-Tenant**: Architecture supports multiple independent communities
6. **API-First**: All features accessible via API for future mobile app

### 3.3 Data Flow

1. User accesses React frontend on Vercel
2. Frontend calls Cloudflare Worker API
3. Worker authenticates via Firebase token
4. Worker reads/writes to D1 database
5. Worker caches responses in KV where appropriate
6. Worker stores files in R2
7. Worker triggers background jobs via Queues
8. Background workers process AI, YouTube metadata, notifications

---

## 4. TECHNOLOGY STACK

### 4.1 Frontend (Vercel)

#### Core Framework

- **React 19** - UI library
- **Vite 8** - Build tool and dev server
- **TypeScript 5.8** - Type safety
- **TanStack Start 1.170** - Full-stack framework (React framework with SSR/client capabilities)
- **TanStack Router 1.170** - Routing

#### UI Components

- **Tailwind CSS 4** - CSS framework
- **Radix UI** - Headless UI components
- **Lucide React** - Icon library
- **Framer Motion** - Animation library
- **Tailwind Merge** - Conditional className utility
- **Class Variance Authority** - Component variant management

#### State Management

- **TanStack Query 5** - Server state management (data fetching, caching)
- **React Hook Form 7** - Form management
- **Zod 3** - Schema validation
- **Zustand** (optional) - Client state for non-server state

#### HTTP Client

- **Axios** or native **fetch** - API communication

#### Utilities

- **Date-fns** - Date manipulation
- **clsx** - Conditional className
- **cmdk** - Command palette
- **sonner** - Toast notifications

### 4.2 Backend (Cloudflare)

- **Cloudflare Workers** - Serverless compute (API + business logic)
- **Cloudflare D1** - Managed SQLite database
- **Cloudflare KV** - Key-value cache
- **Cloudflare R2** - Object storage
- **Cloudflare Queues** - Message queue for background jobs

### 4.3 Authentication & Push

- **Firebase Authentication** - Google OAuth, email/password
- **Firebase Cloud Messaging** - Push notifications for PWA

### 4.4 External Services

- **YouTube Data API v3** - Metadata fetching (thumbnails, titles, etc.)
- **AI Provider** - OpenAI/Gemini for AI features (analysis, content generation)
- **Email Provider** - SendGrid/Resend for transactional emails
- **WhatsApp Business API** (Phase 2) - Notifications
- **Payment Provider** (Phase 4) - Stripe/Paystack for SaaS

### 4.5 Development Tools

- **Bun** - Package manager and runtime (already in project)
- **ESLint 9** - Linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking
- **Vitest** - Unit testing
- **Playwright** - End-to-end testing

---

## 5. DATABASE SCHEMA (CLOUDFLARE D1)

### 5.1 Schema Design Principles

1. **Soft Deletes**: All important tables use `deleted_at` column
2. **Tenant Isolation**: All community-scoped data includes `tenant_id`
3. **Audit Trail**: Changes to sensitive data create audit log entries
4. **Index Optimization**: Proper indexes for common queries
5. **UUID Primary Keys**: Use UUIDs for public IDs, auto-incrementing integers for internal IDs

### 5.2 Database Tables

#### 5.2.1 Core User Tables

```sql
-- Users table (authenticated users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    display_name TEXT,
    photo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    last_active DATETIME
);

-- Creator profiles (extended user info)
CREATE TABLE creator_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
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

-- YouTube channel connections
CREATE TABLE youtube_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
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

-- User skills
CREATE TABLE user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    skill_name TEXT NOT NULL,
    proficiency TEXT CHECK(proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 5.2.2 Community Tables

```sql
-- Communities/tenants
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    owner_id UUID REFERENCES users(id),
    max_members INTEGER DEFAULT 10000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Community membership
CREATE TABLE community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    user_id UUID REFERENCES users(id),
    role TEXT CHECK(role IN ('owner', 'admin', 'moderator', 'mentor', 'member')) DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('active', 'suspended', 'banned', 'left')) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Community settings
CREATE TABLE community_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    allow_peer_review BOOLEAN DEFAULT TRUE,
    allow_collaboration BOOLEAN DEFAULT TRUE,
    require_approval BOOLEAN DEFAULT TRUE,
    default_language TEXT,
    notification_preferences TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 5.2.3 Pod System Tables

```sql
-- Creator pods (small groups within communities)
CREATE TABLE pods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    tenant_id UUID NOT NULL,
    name TEXT,
    description TEXT,
    max_size INTEGER DEFAULT 15,
    current_size INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    rotation_schedule TEXT CHECK(rotation_schedule IN ('daily', 'weekly', 'monthly')) DEFAULT 'weekly',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pod membership
CREATE TABLE pod_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID REFERENCES pods(id),
    user_id UUID REFERENCES users(id),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    status TEXT CHECK(status IN ('active', 'inactive', 'removed')) DEFAULT 'active'
);

-- Pod rotations (tracks user movement between pods)
CREATE TABLE pod_rotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID REFERENCES pods(id),
    user_id UUID REFERENCES users(id),
    rotated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);
```

#### 5.2.4 Content & Review Tables

```sql
-- Submitted videos/content
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    community_id UUID REFERENCES communities(id),
    tenant_id UUID NOT NULL,
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
    expires_at DATETIME, -- Auto-expire after review period
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reviews assigned to users
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id),
    reviewer_id UUID REFERENCES users(id), -- Person doing the review
    submitter_id UUID REFERENCES users(id), -- Person who submitted the video
    status TEXT CHECK(status IN ('assigned', 'in_progress', 'completed', 'overdue', 'skipped')) DEFAULT 'assigned',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    score INTEGER, -- Overall score given by reviewer
    feedback_text TEXT,
    estimated_minutes INTEGER, -- Estimated time spent reviewing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Review question templates
CREATE TABLE review_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    question_text TEXT NOT NULL,
    question_type TEXT CHECK(question_type IN ('rating', 'text', 'multiple_choice', 'yes_no')) DEFAULT 'rating',
    category TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    order_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual review answers
CREATE TABLE review_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID REFERENCES reviews(id),
    question_id UUID REFERENCES review_questions(id),
    rating_value INTEGER,
    text_answer TEXT,
    choice_answer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 5.2.5 Gamification Tables

```sql
-- Credit accounts (community contribution currency)
CREATE TABLE credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    community_id UUID REFERENCES communities(id),
    balance INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Credit transactions (ledger for audit trail)
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    community_id UUID REFERENCES communities(id),
    amount INTEGER NOT NULL, -- Positive = earned, Negative = spent
    type TEXT CHECK(type IN ('earned', 'spent', 'bonus', 'penalty', 'refund', 'admin')) NOT NULL,
    description TEXT,
    reference_id UUID, -- e.g., review_id, video_id
    reference_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- XP accounts
CREATE TABLE xp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    community_id UUID REFERENCES communities(id),
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    xp_to_next_level INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- XP transactions
CREATE TABLE xp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    community_id UUID REFERENCES communities(id),
    amount INTEGER NOT NULL,
    type TEXT CHECK(type IN ('mission', 'challenge', 'review', 'feedback', 'login', 'bonus', 'penalty')) NOT NULL,
    description TEXT,
    reference_id UUID,
    reference_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reputation scores
CREATE TABLE reputation_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    community_id UUID REFERENCES communities(id),
    score INTEGER DEFAULT 100, -- Start at 100, can go up or down
    last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reputation events
CREATE TABLE reputation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    community_id UUID REFERENCES communities(id),
    event_type TEXT NOT NULL,
    points_change INTEGER NOT NULL,
    description TEXT,
    reference_id UUID,
    reference_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Streaks
CREATE TABLE streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    community_id UUID REFERENCES communities(id),
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    streak_type TEXT CHECK(streak_type IN ('daily_login', 'daily_mission', 'daily_review')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Badges
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    criteria_type TEXT NOT NULL,
    criteria_value TEXT,
    xp_reward INTEGER DEFAULT 0,
    credit_reward INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User badge awards
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    badge_id UUID REFERENCES badges(id),
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 5.2.6 Mission System Tables

```sql
-- Missions (daily/weekly tasks)
CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    tenant_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    mission_type TEXT CHECK(mission_type IN ('content', 'feedback', 'learning', 'collaboration', 'community', 'creative', 'ai', 'challenge')) NOT NULL,
    difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
    xp_reward INTEGER DEFAULT 25,
    credit_reward INTEGER DEFAULT 10,
    time_estimate_minutes INTEGER DEFAULT 15,
    valid_from DATETIME,
    valid_to DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    is_repeatable BOOLEAN DEFAULT FALSE,
    max_completions INTEGER,
    created_by UUID REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mission assignments (per user)
CREATE TABLE mission_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id),
    user_id UUID REFERENCES users(id),
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    status TEXT CHECK(status IN ('assigned', 'in_progress', 'completed', 'expired', 'skipped')) DEFAULT 'assigned',
    completion_bonus_applied BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mission templates (reusable mission blueprints)
CREATE TABLE mission_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    template_data JSON, -- Contains all configurable fields
    is_system_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 5.2.7 Challenge System Tables

```sql
-- Challenges (larger, multi-day goals)
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    tenant_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    xp_reward INTEGER DEFAULT 100,
    credit_reward INTEGER DEFAULT 50,
    badge_id UUID REFERENCES badges(id),
    is_active BOOLEAN DEFAULT TRUE,
    max_participants INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Challenge entries
CREATE TABLE challenge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID REFERENCES challenges(id),
    user_id UUID REFERENCES users(id),
    entry_data JSON, -- Submission data (text, image URL, etc.)
    score INTEGER,
    rank INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Challenge votes
CREATE TABLE challenge_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID REFERENCES challenges(id),
    voter_id UUID REFERENCES users(id),
    entry_id UUID REFERENCES challenge_entries(id),
    vote_value INTEGER CHECK(vote_value BETWEEN 1 AND 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(challenge_id, voter_id, entry_id)
);
```

#### 5.2.8 Admin & Moderation Tables

```sql
-- Admin actions log
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id),
    action_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    old_values JSON,
    new_values JSON,
    reason TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reports/flags
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id),
    reported_user_id UUID REFERENCES users(id),
    resource_type TEXT CHECK(resource_type IN ('video', 'review', 'comment', 'user', 'community')),
    resource_id UUID,
    reason TEXT CHECK(reason IN ('spam', 'inappropriate', 'harassment', 'cheating', 'misleading', 'other')),
    description TEXT,
    status TEXT CHECK(status IN ('pending', 'investigating', 'resolved', 'dismissed')) DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT,
    message TEXT,
    data JSON,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
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

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.3 Database Indexes

```sql
-- Indexes for performance
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_xp_transactions_user_id ON xp_transactions(user_id);
CREATE INDEX idx_community_members_user_id ON community_members(user_id);
CREATE INDEX idx_community_members_community_id ON community_members(community_id);
CREATE INDEX idx_pod_members_user_id ON pod_members(user_id);
CREATE INDEX idx_pod_members_pod_id ON pod_members(pod_id);
CREATE INDEX idx_mission_assignments_user_id ON mission_assignments(user_id);
CREATE INDEX idx_mission_assignments_status ON mission_assignments(status);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

---

## 6. API DESIGN

### 6.1 API Design Principles

1. **RESTful Architecture**: Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
2. **Versioned**: All endpoints under `/api/v1/`
3. **JWT Authentication**: Bearer token auth via Firebase Auth
4. **Rate Limiting**: 100 requests per minute per user
5. **Pagination**: Standard `page` and `limit` query parameters
6. **Filtering**: Standard query parameters for filtering
7. **Error Handling**: Standardized error response format
8. **Input Validation**: Zod schemas for all inputs

### 6.2 Standard Response Format

```json
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "v1"
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "issue": "Email is required"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "v1"
  }
}
```

### 6.3 Authentication Endpoints

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh-token
GET /api/v1/auth/me
PUT /api/v1/auth/profile
PUT /api/v1/auth/password
```

### 6.4 User & Profile Endpoints

```
GET /api/v1/users/me
PUT /api/v1/users/profile
PUT /api/v1/users/creator-profile
POST /api/v1/users/avatar
GET /api/v1/users/{userId}
GET /api/v1/users/{userId}/videos
GET /api/v1/users/{userId}/badges
```

### 6.5 Community Endpoints

```
GET /api/v1/communities
POST /api/v1/communities
GET /api/v1/communities/{communityId}
PUT /api/v1/communities/{communityId}
DELETE /api/v1/communities/{communityId}
GET /api/v1/communities/{communityId}/members
POST /api/v1/communities/{communityId}/join
DELETE /api/v1/communities/{communityId}/members/{userId}
PUT /api/v1/communities/{communityId}/settings
```

### 6.6 Pod Endpoints

```
GET /api/v1/communities/{communityId}/pods
POST /api/v1/communities/{communityId}/pods
GET /api/v1/pods/{podId}
PUT /api/v1/pods/{podId}
DELETE /api/v1/pods/{podId}
POST /api/v1/pods/{podId}/members
DELETE /api/v1/pods/{podId}/members/{userId}
POST /api/v1/pods/{podId}/rotate
```

### 6.7 Video & Review Endpoints

```
POST /api/v1/videos
GET /api/v1/videos
GET /api/v1/videos/{videoId}
PUT /api/v1/videos/{videoId}
DELETE /api/v1/videos/{videoId}
GET /api/v1/videos/{videoId}/reviews
GET /api/v1/reviews
GET /api/v1/reviews/{reviewId}
PUT /api/v1/reviews/{reviewId}
POST /api/v1/reviews/{reviewId}/answers
```

### 6.8 Mission Endpoints

```
GET /api/v1/missions
POST /api/v1/missions
GET /api/v1/missions/{missionId}
PUT /api/v1/missions/{missionId}
DELETE /api/v1/missions/{missionId}
POST /api/v1/missions/{missionId}/assign
GET /api/v1/missions/assignments
PUT /api/v1/missions/assignments/{assignmentId}/complete
```

### 6.9 Challenge Endpoints

```
GET /api/v1/challenges
POST /api/v1/challenges
GET /api/v1/challenges/{challengeId}
POST /api/v1/challenges/{challengeId}/join
GET /api/v1/challenges/{challengeId}/entries
POST /api/v1/challenges/{challengeId}/entries
POST /api/v1/challenges/{challengeId}/votes
```

### 6.10 Gamification Endpoints

```
GET /api/v1/credits
GET /api/v1/credits/transactions
GET /api/v1/xp
GET /api/v1/xp/transactions
GET /api/v1/reputation
GET /api/v1/streaks
GET /api/v1/badges
POST /api/v1/badges/award
GET /api/v1/leaderboards
```

### 6.11 Admin Endpoints

```
GET /api/v1/admin/users
GET /api/v1/admin/communities
GET /api/v1/admin/reports
POST /api/v1/admin/reports/{reportId}/resolve
GET /api/v1/admin/logs
GET /api/v1/admin/metrics
```

### 6.12 Notification Endpoints

```
GET /api/v1/notifications
POST /api/v1/notifications
PUT /api/v1/notifications/{notificationId}/read
DELETE /api/v1/notifications/{notificationId}
PUT /api/v1/notifications/preferences
```

---

## 7. GAMIFICATION SYSTEM

### 7.1 XP System

#### XP Earning Activities

| Activity                     | XP Reward | Conditions                    |
| ---------------------------- | --------- | ----------------------------- |
| Complete profile             | +50       | First time only               |
| Connect YouTube channel      | +30       | First time only               |
| Complete daily mission       | +25       | Once per day                  |
| Complete weekly challenge    | +100      | Once per challenge            |
| Give helpful review          | +20       | When review is marked helpful |
| Receive positive feedback    | +10       | From review recipient         |
| Join community               | +10       | First community only          |
| Maintain streak (7 days)     | +50       | Weekly bonus                  |
| Maintain streak (30 days)    | +200      | Monthly bonus                 |
| Participate in collaboration | +50       | Per collaboration             |
| Complete AI coaching session | +15       | Per session                   |

#### Leveling System

| Level                  | XP Required | Requirements        |
| ---------------------- | ----------- | ------------------- |
| 1 - New Creator        | 0           | Complete onboarding |
| 2 - Active Creator     | 100         | Earn 100 XP         |
| 3 - Community Member   | 500         | 500 XP              |
| 4 - Supportive Creator | 1,500       | 1,500 XP            |
| 5 - Peer Mentor        | 5,000       | 5,000 XP            |
| 6 - Community Leader   | 15,000      | 15,000 XP           |
| 7 - Creator Champion   | 50,000      | 50,000 XP           |
| 8 - Master Creator     | 150,000     | 150,000 XP          |

### 7.2 Credit System

#### Credit Earning Activities

| Activity                      | Credit Reward | Daily Limit |
| ----------------------------- | ------------- | ----------- |
| Review someone's video        | +5            | 5/day       |
| Provide helpful feedback      | +3            | No limit    |
| Complete mission task         | +10           | No limit    |
| Participate in challenge      | +2            | 1/day       |
| Maintain streak (7 days)      | +20           | Weekly      |
| Receive 5-star review         | +2            | No limit    |
| Give feedback on peer profile | +1            | No limit    |

#### Credit Spending

| Activity                       | Credit Cost | Conditions            |
| ------------------------------ | ----------- | --------------------- |
| Submit video for reviews       | -5          | Must have 5+ credits  |
| Request AI analysis            | -3          | Must have 3+ credits  |
| Request collaboration match    | -10         | Must have 10+ credits |
| Create custom challenge        | -20         | Must have 20+ credits |
| Get featured in community      | -50         | Must have 50+ credits |
| Send direct message to creator | -1          | Must have 1+ credits  |
| Get profile highlighted        | -5          | Must have 5+ credits  |

### 7.3 Reputation System

Starting reputation: 100

#### Reputation Earning

| Event                   | Reputation Change | Max Per Day |
| ----------------------- | ----------------- | ----------- |
| Review completed        | +1                | 5           |
| Helpful review          | +2                | 3           |
| Positive peer feedback  | +1                | 3           |
| Report accepted         | +5                | 1           |
| Collaboration completed | +10               | 1           |
| Mentor new creator      | +15               | 1           |

#### Reputation Deduction

| Event                  | Reputation Change | Consequences         |
| ---------------------- | ----------------- | -------------------- |
| Review skipped         | -5                | Visible flag         |
| Review overdue         | -3                | Warning              |
| Negative peer feedback | -5                | Review required      |
| Spam/unhelpful review  | -10               | Temporary suspension |
| Cheating detected      | -50               | Long suspension      |
| Harassment             | -100              | Permanent ban        |
| Copyright violation    | -200              | Permanent ban        |

### 7.4 Badge System

#### Achievement Badges

| Name              | Requirement                                 |
| ----------------- | ------------------------------------------- |
| First Video       | Submit first video for review               |
| 7-Day Streak      | Complete activities for 7 consecutive days  |
| 30-Day Streak     | Complete activities for 30 consecutive days |
| Helpful Creator   | Receive 10 helpful reviews                  |
| Feedback Master   | Give 50 reviews                             |
| Collaboration Pro | Complete 5 collaborations                   |
| Community Builder | Refer 5 new members                         |
| Mentor            | Mentor 3 new creators                       |
| Challenge Winner  | Win 1 challenge                             |
| Top Contributor   | Earn 1000 credits                           |
| Reputation Master | Achieve 200 reputation                      |

#### Participation Badges

| Name              | Requirement                             |
| ----------------- | --------------------------------------- |
| Daily Reviewer    | Complete 1 review every day for 14 days |
| Weekly Challenger | Participate in 4 weekly challenges      |
| Pod Leader        | Lead a pod for 30 days                  |
| Community Regular | Be active for 60 days                   |

### 7.5 Streak System

#### Streak Types

1. **Daily Mission Streak**: Complete daily missions
2. **Daily Review Streak**: Complete at least one review per day
3. **Login Streak**: Visit the platform daily

#### Streak Rewards

| Streak Length | Reward                          |
| ------------- | ------------------------------- |
| 7 days        | +50 XP bonus                    |
| 14 days       | +100 XP bonus, special badge    |
| 30 days       | +500 XP bonus, special badge    |
| 60 days       | +1000 XP bonus, featured badge  |
| 100 days      | +2500 XP bonus, legendary badge |

#### Streak Protection

Users get 1 "streak freeze" per month that can be used to protect a streak when they miss a day.

### 7.6 Leaderboard System

#### Leaderboard Types

1. **Weekly Leaderboard**: Top contributors this week
2. **Monthly Leaderboard**: Top contributors this month
3. **All-time Leaderboard**: Top contributors ever
4. **Pod Leaderboard**: Top contributors in current pod
5. **Community Leaderboard**: Top contributors in community

#### Leaderboard Scoring

Weighted score = (XP × 0.4) + (Credits × 0.3) + (Reputation × 0.3)

---

## 8. ANTI-CHEAT & VERIFICATION

### 8.1 Core Principle

The platform **cannot and will not** verify YouTube actions (watching, liking, subscribing) through APIs. YouTube does not expose this data for privacy reasons and explicitly prohibits automated verification of engagement. Any system claiming to verify such actions through APIs would violate YouTube's terms of service.

Instead, the anti-cheat system focuses on **platform behavior** and **genuine community participation**.

### 8.2 Behavior-Based Anti-Cheat

#### Rate Limiting

- Max 10 video submissions per day per user
- Max 20 reviews per day per user
- Max 5 mission completions per day
- Max 10 credit-earning actions per hour

#### Time-Based Detection

- Reviews must take minimum 2 minutes each
- Missions must take estimated time or more
- Rapid completion of multiple tasks flagged for review

#### Quality Detection

- Reviews with < 20 words automatically flagged
- Identical feedback patterns detected
- "Nice video" style responses flagged as low quality
- Helpful/not helpful feedback tracking

### 8.3 Platform Participation Verification

#### Content Questions System

When a creator submits a video, they set 1-3 challenge questions that watchers must answer to prove they watched:

- "What color shirt did the creator wear in the first 30 seconds?"
- "What was the main topic of the first 2 minutes?"
- "What tool did the creator mention at 1:15?"

These are peer-reviewed, not AI-graded.

#### Screenshot Verification

Users can optionally submit screenshots of their watch time or subscription as evidence.

#### Peer Vouching

Community members can vouch for each other's genuine participation.

### 8.4 Trust Tier System

All users start at Trust Tier 1:

| Tier         | Requirements                              | Privileges                                  |
| ------------ | ----------------------------------------- | ------------------------------------------- |
| 1 - New      | Sign up                                   | Standard access                             |
| 2 - Verified | Complete profile, 5 reviews, 1 week old   | Increased limits                            |
| 3 - Trusted  | 50 reviews, 90 days old, 80+ reputation   | Priority assignment, featured content       |
| 4 - Elite    | 200 reviews, 180 days old, 95+ reputation | Early access features, community moderation |

### 8.5 Reputation Impact on Visibility

Users with low reputation (below 50):

- Videos get fewer review assignments
- Content appears lower in discovery
- Limited interaction capabilities
- More frequent manual review required

### 8.6 Automated Suspension

System automatically suspends accounts that:

- Are detected cheating (pattern-based)
- Have consistently low-quality reviews
- Receive multiple negative peer feedbacks
- Spam or post inappropriate content
- Are reported and verified

### 8.7 Manual Moderation Queue

Flagged content goes into moderator queue for human review:

- Suspicious pattern detection
- Multiple reports against same user
- Content that fails automated checks
- User requests for appeal

### 8.8 Appeal System

Suspended users can submit appeal requests that go to community moderators.

---

## 9. FRONTEND ARCHITECTURE

### 9.1 Project Structure

```
src/
├── app/
│   ├── routes/         # Route definitions
│   │   ├── __root.tsx  # Root layout
│   │   ├── auth/       # Auth routes
│   │   ├── dashboard/  # Main dashboard
│   │   ├── community/  # Community pages
│   │   └── profile/    # User profiles
│   ├── components/     # Shared components
│   │   ├── layout/     # Layout components
│   │   ├── common/     # Common UI (buttons, cards, etc.)
│   │   ├── forms/      # Form components
│   │   └── icons/      # Custom icons
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions
│   ├── stores/         # State management
│   ├── styles/         # Global styles
│   ├── types/          # TypeScript types
│   └── utils/          # Helper utilities
├── public/             # Static assets
└── assets/             # Images, fonts, etc.
```

### 9.2 Component Architecture

#### Design System Components

1. **Button** - Primary, Secondary, Outline, Ghost variants
2. **Card** - Content containers with header, body, footer
3. **Input** - Text, Email, Password, Number fields
4. **Select** - Dropdown selector
5. **Modal/Dialog** - Overlay windows
6. **Toast** - Notification messages
7. **Badge** - Status indicators
8. **Progress** - Progress bars
9. **Avatar** - User profile images
10. **Tabs** - Tabbed interface
11. **Table** - Data tables
12. **Pagination** - List navigation
13. **Form** - Form handling with validation

#### Page Components

1. **Dashboard** - Main hub showing missions, reviews, streaks
2. **Community** - Community feed, members, settings
3. **Pod** - Pod view with members, assignments
4. **Videos** - Video submission and review list
5. **Reviews** - Review assignments and completed reviews
6. **Missions** - Daily/weekly mission list
7. **Challenges** - Ongoing challenges
8. **Leaderboard** - Rankings
9. **Profile** - User profile editing
10. **Admin** - Admin dashboard

### 9.3 State Management

#### Server State (TanStack Query)

- API calls cached and synchronized
- Automatic refetching on focus/reconnect
- Mutation handling with optimistic updates

#### Client State (React Context/Zustand)

- Auth state
- UI preferences (theme, language)
- Modal states
- Navigation state

### 9.4 Routing (TanStack Router)

Protected routes require authentication.
Community routes check membership.
Admin routes check permissions.

### 9.5 Styling Approach

- Tailwind CSS utility classes
- CSS variables for theme colors
- Responsive design (mobile-first)
- Dark mode support

### 9.6 PWA Features

- Offline caching via service worker
- Installable on devices
- Push notifications
- Home screen icon

---

## 10. BACKEND ARCHITECTURE

### 10.1 Cloudflare Worker Structure

```
src/
├── routes/
│   ├── auth.ts        # Authentication endpoints
│   ├── users.ts       # User profile endpoints
│   ├── communities.ts # Community endpoints
│   ├── pods.ts        # Pod management
│   ├── videos.ts      # Video submission/review
│   ├── missions.ts    # Mission system
│   ├── challenges.ts  # Challenge system
│   ├── gamification.ts # Credits, XP, badges
│   ├── admin.ts       # Admin endpoints
│   └── notifications.ts # Notification system
├── middleware/
│   ├── auth.ts        # JWT verification
│   ├── tenant.ts      # Tenant isolation
│   ├── rateLimit.ts   # Rate limiting
│   └── validation.ts  # Input validation
├── services/
│   ├── db.ts          # Database client
│   ├── youtube.ts     # YouTube API service
│   ├── ai.ts          # AI service integration
│   ├── email.ts       # Email service
│   ├── whatsapp.ts    # WhatsApp service
│   └── push.ts        # Push notifications
├── queues/
│   ├── email.ts       # Email queue processor
│   ├── ai.ts          # AI processing queue
│   └── notification.ts # Notification queue
├── lib/
│   ├── validation/    # Zod schemas
│   ├── utils/         # Utility functions
│   ├── constants.ts   # Constants
│   └── errors.ts      # Error handlers
└── index.ts           # Entry point
```

### 10.2 Middleware Pipeline

1. **CORS** - Handle cross-origin requests
2. **Rate Limiting** - Prevent abuse
3. **Authentication** - Verify Firebase JWT
4. **Tenant Identification** - Determine community context
5. **Input Validation** - Validate request body
6. **Audit Logging** - Log sensitive actions

### 10.3 Background Job Architecture

Queue-based processing for non-critical tasks:

1. Email notifications
2. Email sending
3. AI analysis
4. YouTube metadata fetching
5. Leaderboard calculation
6. Reputation calculation
7. Streak updates
8. Data cleanup

### 10.4 Caching Strategy

#### KV Cache Layers

1. **User Cache** - Frequently accessed user data (5 min TTL)
2. **Community Cache** - Community details (10 min TTL)
3. **YouTube Metadata Cache** - Video metadata (24 hour TTL)
4. **Leaderboard Cache** - Computed leaderboards (1 hour TTL)
5. **Configuration Cache** - App settings (1 hour TTL)

### 10.5 Security Measures

1. **JWT Verification** - All requests verify Firebase token
2. **Input Sanitization** - Prevent XSS and injection
3. **SQL Injection Prevention** - Parameterized queries only
4. **CSRF Protection** - JWT in Authorization header
5. **Content Security** - File upload validation
6. **API Rate Limiting** - 100 req/min per IP/user
7. **Error Handling** - Generic errors, detailed logs

---

## 11. DEVELOPMENT PHASES

### Phase 1: Foundation (Weeks 1-2)

#### Week 1: Project Setup & Infrastructure

- Set up repository with monorepo structure
- Configure Cloudflare Workers development environment
- Set up D1 database with migrations
- Configure KV and R2
- Set up Firebase Authentication
- Create basic CI/CD pipeline
- Write initial documentation

#### Week 2: Authentication & User Management

- Implement Firebase Auth integration
- Create user registration/login flows
- Build profile creation/editing
- Set up authentication middleware
- Implement basic RBAC
- Create user model and database schema
- Add profile validation

### Phase 2: MVP Core Features (Weeks 3-5)

#### Week 3: Community System

- Create community creation flow
- Implement private/community membership
- Build invite code system
- Add community settings
- Create community discovery
- Set up community RBAC

#### Week 4: Video Submission & Review System

- Build video submission flow
- Create YouTube URL validation
- Implement video metadata fetching
- Build review assignment system
- Create structured review forms
- Add review submission

#### Week 5: Gamification Core

- Implement credit system
- Build XP tracking
- Add streak system
- Create basic badges
- Set up level progression
- Add contribution balance tracking

### Phase 3: MVP Completion & Testing (Week 6)

#### Week 6: Admin & Polish

- Build admin dashboard
- Implement content moderation
- Add reporting system
- Create basic analytics
- Polish UI/UX
- Write tests
- Deploy staging environment
- Conduct beta testing with WhatsApp group

### Phase 4: V1.5 Features (Weeks 7-10)

#### Week 7-8: Pod System & Mission Engine

- Implement pod creation and management
- Build pod rotation algorithm
- Create mission templates
- Add daily/weekly mission scheduling
- Build mission assignment logic

#### Week 9-10: Advanced Gamification

- Complete badge system
- Add reputation engine
- Build feedback quality tracking
- Create leaderboards
- Add challenge system
- Implement achievement notifications

### Phase 5: V2 Features (Weeks 11-14)

#### Week 11-12: AI Integration

- Integrate AI provider for video analysis
- Build AI content idea generator
- Create AI title/thumbnail suggestions
- Add AI content calendar
- Implement AI feedback assistant

#### Week 13-14: Collaboration & Discovery

- Build creator matchmaking
- Create collaboration marketplace
- Implement advanced search/filter
- Add creator discovery features
- Build content recommendation

### Phase 6: V3-V5 Roadmap (Months 3-6)

#### Month 3: Community Enhancement

- Public creator profiles
- Creator directory
- Content portfolio
- Mentorship program
- Workshop system

#### Month 4-5: SaaS Features

- Multi-community support
- Custom domains
- Branding customization
- Pricing plans
- Payment integration

#### Month 6: Scale & Polish

- Performance optimization
- Mobile app planning
- Internationalization
- Advanced analytics
- Security audit

---

## 12. DETAILED IMPLEMENTATION STEPS

### Step 1: Initialize Development Environment

1. Install Node.js 22.x LTS
2. Install Bun package manager
3. Install Wrangler CLI for Cloudflare Workers
4. Clone the repository
5. Run `bun install` to install dependencies
6. Create `.dev.vars` file with development environment variables
7. Run `wrangler dev` to start local development server
8. Run `bun run dev` to start frontend development server

### Step 2: Set Up Project Structure

1. Create directory structure for API routes
2. Set up middleware folder
3. Create services folder
4. Add validation schemas
5. Configure TypeScript paths
6. Set up ESLint and Prettier
7. Create initial migration files
8. Set up testing infrastructure

### Step 3: Database Setup

1. Create D1 database instance on Cloudflare
2. Write migration files for all tables
3. Run migrations locally using `wrangler d1 execute`
4. Test database operations
5. Set up database type generation
6. Create database utility functions

### Step 4: Authentication System

1. Set up Firebase project for authentication
2. Configure Google OAuth provider
3. Create Firebase Auth client SDK
4. Implement token verification in Workers
5. Build auth middleware
6. Create protected route wrapper
7. Implement signup/login/logout flows
8. Add password reset functionality

### Step 5: User Profile Management

1. Create user profile database schema
2. Build profile creation form
3. Implement profile editing
4. Add avatar upload to R2
5. Create profile validation schemas
6. Build profile viewing for other users
7. Add profile completeness checking

### Step 6: Community System

1. Create community database schema
2. Build community creation flow
3. Implement invite code system
4. Add community joining/leaving
5. Create community settings management
6. Build member management interface
7. Add community discovery/search
8. Implement community roles and permissions

### Step 7: Pod System

1. Create pod database schema
2. Implement pod creation
3. Build pod assignment algorithm
4. Add pod member management
5. Create pod rotation system
6. Build pod dashboard interface
7. Implement pod communication features

### Step 8: Video Submission System

1. Create video database schema
2. Build video submission form
3. Implement YouTube URL validation
4. Create YouTube metadata fetching
5. Add video approval workflow
6. Build video listing with filters
7. Implement video status tracking

### Step 9: Review System

1. Create review database schema
2. Implement automated review assignment
3. Build structured review forms
4. Add review submission logic
5. Create review quality tracking
6. Implement review completion
7. Build review dashboard

### Step 10: Mission Engine

1. Create mission database schema
2. Implement mission template system
3. Build daily/weekly mission scheduling
4. Add mission assignment logic
5. Create mission completion tracking
6. Build mission dashboard interface

### Step 11: Gamification System

1. Create gamification database schema
2. Implement credit ledger system
3. Build XP tracking
4. Add streak system
5. Create badge award system
6. Implement reputation engine
7. Build leaderboard calculations
8. Add gamification notifications

### Step 12: Admin Dashboard

1. Create admin database schema
2. Build admin panel interface
3. Implement user management
4. Add community management
5. Create content moderation tools
6. Build reporting system
7. Implement analytics dashboard
8. Add audit log viewer

### Step 13: Notifications System

1. Create notifications database schema
2. Implement notification service
3. Add email notifications
4. Create in-app notifications
5. Implement push notifications (FCM)
6. Build notification center UI
7. Add notification preferences

### Step 14: Frontend Implementation

1. Set up React app with Vite
2. Configure routing with TanStack Router
3. Implement authentication flows
4. Build dashboard interface
5. Create community pages
6. Build pod interfaces
7. Implement video submission UI
8. Add review forms
9. Create mission interfaces
10. Build gamification displays
11. Implement admin panel
12. Add responsive design

### Step 15: Testing

1. Write unit tests for backend functions
2. Implement integration tests for API endpoints
3. Create end-to-end tests with Playwright
4. Test authentication flows
5. Test community workflows
6. Test video submission and review flows
7. Test gamification systems
8. Test admin functions

### Step 16: Deployment

1. Set up production database
2. Configure production environment variables
3. Deploy backend to Cloudflare Workers
4. Deploy frontend to Vercel
5. Configure CDN and DNS
6. Set up SSL certificates
7. Implement monitoring
8. Set up backups

### Step 17: Monitoring & Analytics

1. Set up application error tracking
2. Implement performance monitoring
3. Add business metric tracking
4. Create admin analytics dashboard
5. Set up log aggregation
6. Implement alerting system
7. Add uptime monitoring

---

## 13. TESTING STRATEGY

### 13.1 Testing Pyramid

```
        ┌─────────────┐
        │    E2E      │ (10%)
        │ Playwright  │
        └─────────────┘
    ┌───────────────────┐
    │   Integration     │ (20%)
    │  API Tests        │
    └───────────────────┘
┌─────────────────────────────┐
│      Unit Tests             │ (70%)
│ Vitest + Testing Library    │
└─────────────────────────────┘
```

### 13.2 Backend Testing

#### Unit Tests (Vitest)

- Authentication functions
- Gamification calculations
- Pod assignment algorithms
- Review quality scoring
- Reputation calculations
- Currency conversions
- Date/time utilities

#### Integration Tests

- API endpoint responses
- Database operations
- Authentication flows
- Community workflows
- Video submission flows
- Review assignment logic
- Mission scheduling
- Credit/XP transactions

### 13.3 Frontend Testing

#### Component Tests (React Testing Library)

- Form validation
- Button states
- Modal interactions
- Data display
- Loading states
- Error states

#### Integration Tests

- Authentication flows
- Dashboard interactions
- Community navigation
- Video submission forms
- Review form submissions
- Mission interactions
- Gamification displays

### 13.4 End-to-End Tests (Playwright)

Core user journeys:

1. Complete signup and onboarding
2. Create and join community
3. Submit video for review
4. Complete review for another creator
5. Complete daily mission
6. Check gamification progress
7. Admin moderate content
8. Receive and read notification

### 13.5 Testing Infrastructure

- Test database (separate from dev/prod)
- Mock external services (YouTube API, Email, AI)
- Test user fixtures
- Test data factories
- CI/CD integration

---

## 14. DEPLOYMENT & CI/CD

### 14.1 Repository Structure

```
creatorloop/
├── .github/
│   └── workflows/     # CI/CD pipelines
├── workers/           # Cloudflare Workers
│   └── api/
├── apps/
│   ├── web/          # React frontend
│   └── admin/        # Admin panel (future)
├── packages/          # Shared packages (future)
├── docs/             # Documentation
├── scripts/          # Deployment scripts
├── migrations/       # Database migrations
├── tests/            # Test files
└── package.json
```

### 14.2 CI/CD Pipeline

#### GitHub Actions Workflows

1. **CI Workflow** (`ci.yml`)
   - Run on push and pull request
   - Install dependencies
   - Run lint checks
   - Run type checking
   - Run unit tests
   - Build frontend
   - Build backend
   - Run integration tests

2. **Deploy to Staging** (`deploy-staging.yml`)
   - Run on merge to staging branch
   - Deploy backend to Cloudflare Workers
   - Deploy frontend to Vercel staging
   - Run smoke tests

3. **Deploy to Production** (`deploy-production.yml`)
   - Run on merge to main branch
   - Deploy backend to Cloudflare Workers
   - Deploy frontend to Vercel production
   - Run health checks
   - Notify team

### 14.3 Environment Variables

#### Backend (.dev.vars for local, secrets for production)

```env
# Firebase
FIREBASE_PROJECT_ID=creatorloop-dev
FIREBASE_CLIENT_EMAIL=...

# YouTube API
YOUTUBE_API_KEY=...

# AI Provider
AI_PROVIDER_API_KEY=...

# Email
EMAIL_API_KEY=...
EMAIL_FROM=...

# Security
JWT_SECRET=...
ENCRYPTION_KEY=...

# Analytics
ANALYTICS_ID=...

# Database (auto-set by Wrangler)
DATABASE_URL=...
```

#### Frontend (.env.local for local, env vars for production)

```env
VITE_API_URL=http://localhost:8787
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_APP_NAME=CreatorLoop
```

### 14.4 Deployment Steps

#### Backend Deployment (Cloudflare Workers)

1. Build the Worker:

   ```bash
   cd workers/api
   bun run build
   ```

2. Deploy to production:
   ```bash
   wrangler deploy --env production
   ```

#### Frontend Deployment (Vercel)

1. Deploy using Vercel CLI:

   ```bash
   vercel --prod
   ```

2. Or push to GitHub; Vercel auto-deploys

### 14.5 Database Migrations

1. Create migration files in `/migrations/` directory
2. Apply migrations to D1:
   ```bash
   wrangler d1 execute creatorloop --local --file=migrations/001_initial.sql
   wrangler d1 execute creatorloop --remote --file=migrations/001_initial.sql
   ```

### 14.6 Rollback Strategy

- Keep last 3 deployments available for rollback
- Database migrations are irreversible; use versioned schema
- Monitor key metrics after deployment
- Alert on critical errors

---

## 15. MONITORING & OPERATIONS

### 15.1 Application Monitoring

#### Backend

- **Cloudflare Logs** - Access and error logs
- **Application Logs** - Custom logging via `console.log()`
- **Error Tracking** - Sentry or custom error tracking worker
- **Performance Metrics** - Response times, throughput

#### Frontend

- **Vercel Analytics** - Page views, performance
- **Error Tracking** - Sentry or custom error tracking
- **User Metrics** - Feature usage, conversion funnels

### 15.2 Business Metrics

#### Key Metrics to Track

| Category     | Metrics                                     |
| ------------ | ------------------------------------------- |
| Activation   | Registration completion, profile creation   |
| Engagement   | DAU, WAU, missions completed, reviews given |
| Retention    | Day 1, 7, 30 retention                      |
| Content      | Videos submitted, reviews completed         |
| Community    | Communities created, members per community  |
| Gamification | Credits earned, XP gained, levels reached   |

### 15.3 Alerting

Critical alerts:

- API error rate > 5%
- Database unavailable
- Authentication failures > 10/min
- Rate limiting triggered
- Suspicious activity detected

### 15.4 Backups

#### Database Backup

- Daily D1 database dumps
- Stored in Cloudflare R2 (encrypted)
- 30 days retention
- Manual restore procedure documented

#### File Backup

- R2 files versioned
- CDN caching enabled
- Cross-region replication

### 15.5 Log Rotation & Management

- Logs automatically expire after 7 days
- Structured JSON logging
- Searchable log interface
- Export for long-term storage

---

## 16. RISK ASSESSMENT

### 16.1 YouTube API Risks

**Risk**: YouTube API quota limits or policy violations
**Impact**: Cannot fetch video metadata
**Mitigation**:

- Cache all YouTube data aggressively
- Implement quota monitoring
- Use multiple API keys if needed
- Have fallback for when API fails

### 16.2 User Engagement Risks

**Risk**: Users game the system or lose interest
**Impact**: Platform becomes unusable or inactive
**Mitigation**:

- Implement robust anti-cheat measures
- Regular gamification updates
- Community feedback loops
- Incentive alignment

### 16.3 Data Privacy Risks

**Risk**: Handling creator YouTube data
**Impact**: Legal compliance issues
**Mitigation**:

- GDPR/CCPA compliance
- Clear privacy policy
- Data minimization
- User consent management

### 16.4 Scalability Risks

**Risk**: Platform can't handle growth
**Impact**: Poor user experience
**Mitigation**:

- Serverless architecture
- Caching strategies
- CDN usage
- Load testing

### 16.5 Technical Debt Risks

**Risk**: Rushed development leads to poor code quality
**Impact**: Difficult maintenance
**Mitigation**:

- Code reviews required for all changes
- Automated testing requirements
- Refactoring sprints
- Documentation

---

## 17. FUTURE ENHANCEMENTS

### V1.5 Features (Planned after MVP)

1. Complete badge and reputation system
2. Advanced challenge system
3. Creator leaderboard
4. Peer feedback quality scoring
5. Notification preferences

### V2 Features

1. AI Creator Coach (video analysis, title optimization)
2. Content idea generator
3. AI-powered thumbnail suggestions
4. Creator matchmaking
5. Collaboration marketplace

### V3 Features

1. Creator analytics dashboard
2. Portfolio system
3. Mentorship program
4. Workshop/event system
5. Public creator directory

### V4 Features

1. Multi-tenant SaaS platform
2. Custom domains
3. Branding customization
4. Subscription billing
5. Team management

### V5 Features

1. Mobile apps (React Native)
2. Advanced AI features
3. Creator marketplace
4. Course platform
5. Opportunity board

---

## 18. APPENDICES

### Appendix A: Glossary

- **Creator**: A user who creates content for platforms like YouTube
- **Community**: A group of creators working together (like a WhatsApp group)
- **Pod**: A smaller group within a community for focused collaboration
- **Mission**: A daily or weekly task that creators complete
- **Challenge**: A multi-day or themed activity for creators
- **Credit**: Platform currency earned by contributing, spent to get support
- **XP**: Experience points tracking level progression
- **Reputation**: A trust score based on quality of participation
- **Streak**: Consecutive days of platform activity
- **Badge**: Achievement awarded for milestones
- **Tenant**: A separate instance of the platform for a coach/organization
- **Coach**: An admin who runs a creator community

### Appendix B: Influences from WhatsApp Discussion

Key insights from the WhatsApp chat that influenced this plan:

1. **"Good evening everyone / Where are we?"** - Need a central hub/dashboard
2. **"Is it must we will add keywords"** - Need education about SEO (missions could cover this)
3. **"Are we competing?"** - Clear this isn't a competition, it's collaboration
4. **"30 groups with 35 persons in each group and a daily reshuffling"** - Pod system with rotation
5. **"I don't want anyone to cheat anyone in the system"** - Anti-cheat system
6. **"My own opinion is that each person should follow and like..."** - Credit system for genuine participation
7. **"Please what should I type in the chrome browser..."** - Mobile-first design is essential
8. **"Only drop your video links not your channel links"** - Follow this principle
9. **"The person liking it.. Needs to watch your video a little, before subscribing"** - Review system for this
10. **"YouTube is against mass follow for follow"** - Don't build sub-for-sub automation

### Appendix C: Compliance Notes

The platform must comply with:

- YouTube Terms of Service and API policies
- GDPR (if serving EU users)
- CCPA (if serving California users)
- COPPA (if collecting data from children under 13)
- Firebase Terms of Service
- Cloudflare Terms of Service

Important: The platform will NOT attempt to verify or track YouTube engagement (likes, subscriptions, watches) through APIs. YouTube's policies explicitly prohibit this. All gamification is based on platform participation (reviews, missions, challenges), not YouTube engagement.

### Appendix D: Cost Estimates (Monthly)

| Service            | Free Tier            | Paid Tier (Expected) |
| ------------------ | -------------------- | -------------------- |
| Cloudflare Workers | 100,000 requests/day | $5-20/month          |
| Cloudflare D1      | 5 million rows       | $5-10/month          |
| Cloudflare KV      | 100,000 reads        | $5-15/month          |
| Cloudflare R2      | 10 GB storage        | $0-5/month           |
| Firebase Auth      | 10,000 verifications | $0-20/month          |
| Firebase FCM       | 1 million messages   | $0/month             |
| Vercel             | Hobby (free)         | $0-20/month          |
| Email Provider     | 100-1,000 emails     | $0-20/month          |
| AI Provider        | Limited free tier    | $20-100/month        |
| **Total (MVP)**    |                      | **$0-100/month**     |

Note: The app is designed to be free to launch with existing free tiers.

### Appendix E: Success Metrics

1. **User Acquisition**: 50 users in first month
2. **Retention**: 70% D1, 40% W1, 20% M1
3. **Engagement**: 2+ missions per user per week
4. **Community Health**: 5+ active communities by month 3
5. **Revenue**: Break-even by month 6 (if monetization layer added)

---

## END OF DOCUMENT

This plan covers every aspect of building CreatorLoop from scratch to production. Each phase includes specific tasks, deliverables, and success criteria. The gamification system balances engagement with platform integrity. The architecture is designed to scale while staying within free tiers initially.

The MVP focuses on the core community and review system without any direct YouTube engagement verification, keeping the platform compliant with YouTube's terms of service.
