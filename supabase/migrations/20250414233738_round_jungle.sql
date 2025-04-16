/*
  # Fix template versions and policies

  1. Changes
    - Ensure version tracking is working correctly
    - Fix policies for community templates
    - Add missing indexes
    - Update triggers for version tracking
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper version history tracking
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage all templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can insert community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can update own community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can delete own community templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can read all templates" ON waf_templates;

-- Ensure all required columns exist with correct defaults
ALTER TABLE waf_templates
ALTER COLUMN created_by DROP NOT NULL,
ALTER COLUMN is_community SET DEFAULT true,
ALTER COLUMN is_core SET DEFAULT false,
ALTER COLUMN version SET DEFAULT 1;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waf_templates_is_community ON waf_templates(is_community);
CREATE INDEX IF NOT EXISTS idx_waf_templates_created_by ON waf_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_waf_templates_is_core ON waf_templates(is_core);
CREATE INDEX IF NOT EXISTS idx_waf_templates_version ON waf_templates(version);

-- Enable RLS
ALTER TABLE waf_templates ENABLE ROW LEVEL SECURITY;

-- Create updated policies
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

-- Update version tracking trigger
CREATE OR REPLACE FUNCTION handle_template_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track changes if content actually changed
  IF (
    OLD.name != NEW.name OR
    OLD.description != NEW.description OR
    OLD.expression != NEW.expression OR
    OLD.action != NEW.action OR
    OLD.action_parameters IS DISTINCT FROM NEW.action_parameters OR
    OLD.target_countries IS DISTINCT FROM NEW.target_countries
  ) THEN
    -- Increment version number
    NEW.version = OLD.version + 1;
    NEW.updated_at = now();
    
    -- Insert record into version history
    INSERT INTO waf_template_versions (
      template_id,
      version,
      name,
      description,
      expression,
      action,
      action_parameters,
      is_core,
      is_community,
      display_order,
      modified_by,
      target_countries
    ) VALUES (
      NEW.id,
      NEW.version,
      NEW.name,
      NEW.description,
      NEW.expression,
      NEW.action,
      NEW.action_parameters,
      NEW.is_core,
      NEW.is_community,
      NEW.display_order,
      auth.jwt()->>'email',
      NEW.target_countries
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS template_version_trigger ON waf_templates;
CREATE TRIGGER template_version_trigger
  BEFORE UPDATE ON waf_templates
  FOR EACH ROW
  EXECUTE FUNCTION handle_template_version();

-- Add policies for version history table
DROP POLICY IF EXISTS "Admin can manage all template versions" ON waf_template_versions;
DROP POLICY IF EXISTS "Users can read template versions" ON waf_template_versions;

CREATE POLICY "Admin can manage all template versions"
  ON waf_template_versions
  FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'steve@shadowtek.com.au')
  WITH CHECK (auth.jwt()->>'email' = 'steve@shadowtek.com.au');

CREATE POLICY "Users can read template versions"
  ON waf_template_versions
  FOR SELECT
  TO authenticated
  USING (true);