-- MemoChat PostgreSQL Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Drop existing tables (for fresh start)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table with hashed passwords
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Messages table for persistent chat history
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    room_name VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_messages_room ON messages(room_name);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_user_id ON messages(user_id);

-- Disable RLS (your Node.js backend handles all security)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Verification queries (uncomment to test)
-- SELECT * FROM users;
-- SELECT * FROM messages WHERE room_name = 'general' ORDER BY created_at DESC LIMIT 20;
-- SELECT COUNT(*) as total_users FROM users;
-- SELECT COUNT(*) as total_messages FROM messages;
