/*
  # Fix WAF templates table structure and policies

  1. Changes
    - Ensure all required columns exist with correct defaults
    - Recreate policies with proper permissions
    - Add missing indexes
    - Fix constraints

  2. Security
    - Maintain existing data
    - Enable RLS
    - Set proper permissions for community templates
*/

-- Ensure table has all required columns with correct defaults
ALTER TABLE waf_templates
ADD COLUMN IF NOT EXISTS created_by text,
ADD COLUMN IF NOT EXISTS is_community boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS target_countries jsonb DEFAULT '["AU"]'::jsonb,
ADD COLUMN IF NOT EXISTS display_order integer,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_waf_templates_is_community ON waf_templates(is_community);
CREATE INDEX IF NOT EXISTS idx_waf_templates_created_by ON waf_templates(created_by);

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage all templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can manage their own community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can read all templates" ON waf_templates;

-- Enable RLS
ALTER TABLE waf_templates ENABLE ROW LEVEL SECURITY;

-- Create updated policies
CREATE POLICY "Admin can manage all templates"
  ON waf_templates
  FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'steve@shadowtek.com.au')
  WITH CHECK (auth.jwt()->>'email' = 'steve@shadowtek.com.au');

CREATE POLICY "Users can manage their own community templates"
  ON waf_templates
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.jwt()->>'email' 
    AND is_community = true
    AND NOT is_core
  )
  WITH CHECK (
    created_by = auth.jwt()->>'email' 
    AND is_community = true
    AND NOT is_core
  );

CREATE POLICY "Users can read all templates"
  ON waf_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Create or update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_waf_templates_updated_at ON waf_templates;
CREATE TRIGGER update_waf_templates_updated_at
  BEFORE UPDATE ON waf_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();