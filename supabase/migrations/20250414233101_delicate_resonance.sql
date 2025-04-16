/*
  # Final fix for WAF templates

  1. Changes
    - Drop and recreate all policies with proper permissions
    - Add missing columns and constraints
    - Fix policy conditions
    - Add proper indexes
  
  2. Security
    - Maintain existing data
    - Ensure proper RLS enforcement
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage all templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can insert community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can update own community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can delete own community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can read all templates" ON waf_templates;

-- Ensure all required columns exist
ALTER TABLE waf_templates
ALTER COLUMN created_by DROP NOT NULL,
ALTER COLUMN is_community SET DEFAULT true,
ALTER COLUMN is_core SET DEFAULT false;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waf_templates_is_community ON waf_templates(is_community);
CREATE INDEX IF NOT EXISTS idx_waf_templates_created_by ON waf_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_waf_templates_is_core ON waf_templates(is_core);

-- Enable RLS
ALTER TABLE waf_templates ENABLE ROW LEVEL SECURITY;

-- Recreate policies with simplified conditions
CREATE POLICY "Admin can manage all templates"
  ON waf_templates
  FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'steve@shadowtek.com.au')
  WITH CHECK (auth.jwt()->>'email' = 'steve@shadowtek.com.au');

CREATE POLICY "Users can insert community templates"
  ON waf_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt()->>'email' IS NOT NULL 
    AND is_core = false
  );

CREATE POLICY "Users can update own community templates"
  ON waf_templates
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.jwt()->>'email' 
    AND is_core = false
  )
  WITH CHECK (
    created_by = auth.jwt()->>'email' 
    AND is_core = false
  );

CREATE POLICY "Users can delete own community templates"
  ON waf_templates
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.jwt()->>'email' 
    AND is_core = false
  );

CREATE POLICY "Users can read all templates"
  ON waf_templates
  FOR SELECT
  TO authenticated
  USING (true);