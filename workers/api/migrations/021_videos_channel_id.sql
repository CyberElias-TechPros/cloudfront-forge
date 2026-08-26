-- Add missing channel_id column to videos table for multi-account detection
ALTER TABLE videos ADD COLUMN channel_id TEXT;