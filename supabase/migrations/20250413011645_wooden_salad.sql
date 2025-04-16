/*
  # Add account name and uniqueness constraint

  1. Changes
    - Add name column to credentials table for account identification
    - Ensure unique combination of user_id and account_id
  
  2. Notes
    - Safely handles cases where constraint already exists
    - Uses DO block for conditional constraint creation
*/

-- Add name column for account identification
ALTER TABLE credentials
ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Default Account';

-- Add unique constraint if it doesn't exist
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