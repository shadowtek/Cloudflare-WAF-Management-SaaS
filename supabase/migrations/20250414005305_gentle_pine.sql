/*
  # Add community templates support

  1. Changes
    - Add `created_by` column to track template creator
    - Add `is_community` flag to identify community templates
    - Update RLS policies to allow users to manage their own templates
    - Add index on created_by for performance

  2. Security
    - Users can only edit their own community templates
    - Admin can edit all templates
    - Everyone can view all templates
*/

-- Add created_by column if it doesn't exist
ALTER TABLE waf_templates
ADD COLUMN IF NOT EXISTS created_by text;

-- Add is_community flag
ALTER TABLE waf_templates
ADD COLUMN IF NOT EXISTS is_community boolean DEFAULT false;

-- Create index on created_by
CREATE INDEX IF NOT EXISTS idx_waf_templates_created_by ON waf_templates(created_by);

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage all templates" ON waf_templates;
DROP POLICY IF EXISTS "Users can read templates" ON waf_templates;

-- Create updated policies
CREATE POLICY "Admin can manage all templates"
  ON waf_templates
  FOR ALL
  TO authenticated
  USING (
    auth.jwt()->>'email' = 'steve@shadowtek.com.au'
  )
  WITH CHECK (
    auth.jwt()->>'email' = 'steve@shadowtek.com.au'
  );

CREATE POLICY "Users can manage their own community templates"
  ON waf_templates
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.jwt()->>'email' AND is_community = true
  )
  WITH CHECK (
    created_by = auth.jwt()->>'email' AND is_community = true
  );

CREATE POLICY "Users can read all templates"
  ON waf_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Update version history table
ALTER TABLE waf_template_versions
ADD COLUMN IF NOT EXISTS is_community boolean DEFAULT false;

-- Update version trigger function to include new fields
CREATE OR REPLACE FUNCTION handle_template_version()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND (
    OLD.name != NEW.name OR
    OLD.description != NEW.description OR
    OLD.expression != NEW.expression OR
    OLD.action != NEW.action OR
    OLD.action_parameters IS DISTINCT FROM NEW.action_parameters
  )) THEN
    NEW.version = OLD.version + 1;
    NEW.updated_at = now();
    
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
      modified_by
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
      auth.jwt()->>'email'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;