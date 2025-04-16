/*
  # Add account switching support

  1. Changes
    - Add `name` column to `credentials` table for account identification
    - Add unique constraint on user_id + account_id to prevent duplicates
    - Update RLS policies to maintain security

  2. Security
    - Maintain existing RLS policies
    - Add unique constraint for user's accounts
*/

-- Add name column for account identification
ALTER TABLE credentials
ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Default Account';

-- Add unique constraint for user_id + account_id combination
ALTER TABLE credentials
ADD CONSTRAINT unique_user_account UNIQUE (user_id, account_id);