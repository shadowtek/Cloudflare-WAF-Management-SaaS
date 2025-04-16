/*
  # Fix WAF template policies and queries

  1. Changes
    - Drop and recreate policies to ensure proper access
    - Add policy for users to manage their community templates
    - Update policy for reading all templates
    - Add index for is_community flag

  2. Security
    - Maintain admin access to all templates
    - Allow users to manage their own community templates
    - Allow all authenticated users to read templates
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage all templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can manage their own community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can read templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can read all templates" ON waf_templates;

-- Create index for is_community flag if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_waf_templates_is_community ON waf_templates(is_community);

-- Recreate policies with proper conditions
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
  )
  WITH CHECK (
    created_by = auth.jwt()->>'email' 
    AND is_community = true
  );

CREATE POLICY "Users can read all templates"
  ON waf_templates
  FOR SELECT
  TO authenticated
  USING (true);