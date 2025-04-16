/*
  # Add core template configuration

  1. New Tables
    - `core_template_config`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `target_countries` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `core_template_config` table
    - Add policy for users to manage their own configuration
*/

CREATE TABLE IF NOT EXISTS core_template_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  target_countries jsonb DEFAULT '["AU"]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_config UNIQUE (user_id)
);

ALTER TABLE core_template_config ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own config
CREATE POLICY "Users can read own config"
  ON core_template_config
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to insert their own config
CREATE POLICY "Users can insert own config"
  ON core_template_config
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own config
CREATE POLICY "Users can update own config"
  ON core_template_config
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create function to handle updated_at
CREATE OR REPLACE FUNCTION update_core_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_core_config_updated_at
  BEFORE UPDATE ON core_template_config
  FOR EACH ROW
  EXECUTE FUNCTION update_core_config_updated_at();