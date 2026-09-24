-- Sanboard Notifications, Listing Price History, and Role Migrations
-- Migration: 20260924000000_notifications_and_roles.sql

-- 1. ADD USER_ID TO FAVORITES & UNIQUE CONSTRAINT
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Backfill user_id from character_profiles if existing data
UPDATE favorites f
SET user_id = cp.user_id
FROM character_profiles cp
WHERE f.profile_id = cp.id AND f.user_id IS NULL;

-- Make user_id NOT NULL after backfill if needed
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_profile_id_listing_id_key;
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_user_id_listing_id_key;
ALTER TABLE favorites ADD CONSTRAINT favorites_user_id_listing_id_key UNIQUE (user_id, listing_id);

-- 2. LISTING PRICE HISTORY TABLE
CREATE TABLE IF NOT EXISTS listing_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    old_price INTEGER NOT NULL,
    new_price INTEGER NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_price_history_listing_changed
ON listing_price_history(listing_id, changed_at DESC);

-- 3. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'LISTING_PRICE_DROP',
        'SUPPORT_REPLY',
        'SYSTEM',
        'LISTING_EXPIRES_SOON',
        'CORPORATE_APPLICATION_APPROVED',
        'CORPORATE_APPLICATION_REJECTED'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT CHECK (entity_type IN ('listing', 'ticket', 'application', 'system')),
    entity_id TEXT,
    metadata JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id, read_at, created_at DESC);
