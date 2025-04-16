/*
  # Fix credentials table constraints

  1. Changes
    - Remove unique constraint on user_id to allow multiple accounts per user
    - Keep unique constraint on user_id + account_id combination
    - Ensure name column exists
*/

-- Remove the unique constraint on user_id if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'credentials_user_id_key'
  ) THEN
    ALTER TABLE credentials
    DROP CONSTRAINT credentials_user_id_key;
  END IF;
END $$;

-- Ensure name column exists and has default value
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'credentials' AND column_name = 'name'
  ) THEN
    ALTER TABLE credentials
    ADD COLUMN name text NOT NULL DEFAULT 'Default Account';
  END IF;
END $$;

-- Ensure unique constraint on user_id + account_id exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'unique_user_account'
  ) THEN
    ALTER TABLE credentials
    ADD CONSTRAINT unique_user_account UNIQUE (user_id, account_id);
  END IF;
END $$;