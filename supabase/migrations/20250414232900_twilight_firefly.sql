/*
  # Fix WAF templates policies and structure

  1. Changes
    - Drop existing policies to ensure clean slate
    - Add missing columns if not present
    - Create proper indexes
    - Set up correct RLS policies for community templates
    - Add trigger for updated_at

  2. Security
    - Maintain existing data
    - Enable RLS
    - Set proper permissions for community templates
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage all templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can manage their own community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can read all templates" ON waf_templates;

-- Ensure table has all required columns with correct defaults
DO $$ 
BEGIN
  ALTER TABLE waf_templates
    ADD COLUMN IF NOT EXISTS created_by text,
    ADD COLUMN IF NOT EXISTS is_community boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS target_countries jsonb DEFAULT '["AU"]'::jsonb,
    ADD COLUMN IF NOT EXISTS display_order integer,
    ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
EXCEPTION
  WHEN duplicate_column THEN
    NULL;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_waf_templates_is_community ON waf_templates(is_community);
CREATE INDEX IF NOT EXISTS idx_waf_templates_created_by ON waf_templates(created_by);

-- Enable RLS
ALTER TABLE waf_templates ENABLE ROW LEVEL SECURITY;

-- Create updated policies with proper permissions
CREATE POLICY "Admin can manage all templates"
  ON waf_templates
  FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'steve@shadowtek.com.au')
  WITH CHECK (auth.jwt()->>'email' = 'steve@shadowtek.com.au');

-- Allow users to insert their own community templates
CREATE POLICY "Users can insert community templates"
  ON waf_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.jwt()->>'email' 
    AND is_community = true 
    AND NOT is_core
  );

-- Allow users to update their own community templates
CREATE POLICY "Users can update own community templates"
  ON waf_templates
  FOR UPDATE
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

-- Allow users to delete their own community templates
CREATE POLICY "Users can delete own community templates"
  ON waf_templates
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.jwt()->>'email' 
    AND is_community = true 
    AND NOT is_core
  );

-- Allow all authenticated users to read templates
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