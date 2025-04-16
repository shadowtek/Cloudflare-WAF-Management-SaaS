/*
  # Fix community templates visibility

  1. Changes
    - Set default value for is_community to true
    - Update existing templates to have correct is_community value
    - Ensure proper indexing for performance
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Set default value for is_community to true
ALTER TABLE waf_templates
ALTER COLUMN is_community SET DEFAULT true;

-- Update existing non-core templates to have is_community = true
UPDATE waf_templates
SET is_community = true
WHERE is_core = false;

-- Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_waf_templates_community_search 
ON waf_templates(is_community, is_core)
WHERE is_community = true AND is_core = false;

-- Ensure proper RLS policies
DROP POLICY IF EXISTS "Users can insert community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can update own community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can delete own community templates" ON waf_templates;

-- Recreate policies with proper conditions
CREATE POLICY "Users can insert community templates"
  ON waf_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt()->>'email' IS NOT NULL 
    AND is_core = false
    AND is_community = true
  );

CREATE POLICY "Users can update own community templates"
  ON waf_templates
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.jwt()->>'email' 
    AND is_core = false
    AND is_community = true
  )
  WITH CHECK (
    created_by = auth.jwt()->>'email' 
    AND is_core = false
    AND is_community = true
  );

CREATE POLICY "Users can delete own community templates"
  ON waf_templates
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.jwt()->>'email' 
    AND is_core = false
    AND is_community = true
  );