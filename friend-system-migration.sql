-- Friend System Database Migration
-- Run this in Supabase SQL Editor

-- 1. Friend Requests Table
CREATE TABLE friend_requests (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    invitation_code VARCHAR(10) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    UNIQUE(sender_id, receiver_id)
);

CREATE INDEX idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX idx_friend_requests_code ON friend_requests(invitation_code);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);

-- 2. Friends Table
CREATE TABLE friends (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (user1_id < user2_id),
    UNIQUE(user1_id, user2_id)
);

CREATE INDEX idx_friends_user1 ON friends(user1_id);
CREATE INDEX idx_friends_user2 ON friends(user2_id);

-- 3. Direct Messages Table
CREATE TABLE direct_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dm_sender ON direct_messages(sender_id);
CREATE INDEX idx_dm_receiver ON direct_messages(receiver_id);
CREATE INDEX idx_dm_created_at ON direct_messages(created_at);
CREATE INDEX idx_dm_unread ON direct_messages(receiver_id, is_read);

-- 4. Update Users Table
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'offline';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;

-- 5. Add user invitation code (each user gets their own permanent code)
ALTER TABLE users ADD COLUMN IF NOT EXISTS my_invitation_code VARCHAR(10) UNIQUE;

-- Generate invitation codes for existing users
UPDATE users 
SET my_invitation_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
WHERE my_invitation_code IS NULL;

-- Disable RLS (your backend handles security)
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE friends DISABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages DISABLE ROW LEVEL SECURITY;
