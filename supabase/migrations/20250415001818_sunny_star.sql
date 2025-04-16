/*
  # Create tables for email-based MFA

  1. New Tables
    - `user_mfa`
      - `user_id` (uuid, primary key)
      - `enabled` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `mfa_codes`
      - `id` (uuid, primary key)
      - `user_id` (uuid)
      - `code` (text)
      - `expires_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own MFA settings
*/

-- Create user_mfa table
CREATE TABLE IF NOT EXISTS user_mfa (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create mfa_codes table
CREATE TABLE IF NOT EXISTS mfa_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for user_mfa
CREATE POLICY "Users can read own MFA settings"
  ON user_mfa
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own MFA settings"
  ON user_mfa
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for mfa_codes
CREATE POLICY "Users can manage own MFA codes"
  ON mfa_codes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_mfa_codes_user_lookup 
ON mfa_codes(user_id, code, expires_at);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_user_mfa_updated_at
  BEFORE UPDATE ON user_mfa
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();