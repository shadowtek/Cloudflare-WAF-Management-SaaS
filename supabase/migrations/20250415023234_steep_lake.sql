/*
  # Add security settings tracking

  1. New Tables
    - `zone_security_settings`
      - `id` (uuid, primary key)
      - `zone_id` (text, not null)
      - `ssl_mode` (text)
      - `min_tls_version` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for users to manage their zone settings
*/

CREATE TABLE IF NOT EXISTS zone_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id text NOT NULL,
  ssl_mode text,
  min_tls_version text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE zone_security_settings ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_zone_security_settings_zone_id 
ON zone_security_settings(zone_id);

-- Create policies
CREATE POLICY "Users can manage zone security settings"
  ON zone_security_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_zone_security_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_zone_security_settings_updated_at
  BEFORE UPDATE ON zone_security_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_zone_security_settings_updated_at();