/*
  # Enforce user_id uniqueness in credentials table

  1. Changes
    - Add unique constraint on user_id column in credentials table
    - This prevents multiple credentials entries for the same user

  2. Data Handling
    - Keep only the most recently updated credential for each user
    - Delete duplicate entries
*/

DO $$ 
BEGIN
  -- Keep only the most recent credential for each user_id
  WITH duplicates AS (
    SELECT id
    FROM (
      SELECT 
        id,
        user_id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id 
          ORDER BY updated_at DESC
        ) as row_num
      FROM credentials
    ) ranked
    WHERE row_num > 1
  )
  DELETE FROM credentials 
  WHERE id IN (SELECT id FROM duplicates);

  -- Add unique constraint on user_id
  ALTER TABLE credentials
  ADD CONSTRAINT credentials_user_id_key UNIQUE (user_id);
END $$;