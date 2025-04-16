/*
  # Add version tracking for WAF templates

  1. Changes
    - Add version number column
    - Add version history table
    - Add trigger to track version history

  2. Security
    - Maintain existing RLS policies
    - Add RLS for version history table
*/

-- Add version column to waf_templates if it doesn't exist
ALTER TABLE waf_templates
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Create version history table
CREATE TABLE IF NOT EXISTS waf_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES waf_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  expression text NOT NULL,
  action text NOT NULL,
  action_parameters jsonb,
  is_core boolean DEFAULT false,
  display_order integer,
  modified_at timestamptz DEFAULT now(),
  modified_by text -- stores the email of the user who made the change
);

-- Enable RLS on version history table
ALTER TABLE waf_template_versions ENABLE ROW LEVEL SECURITY;

-- Add policies for version history table
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

-- Create function to handle version updates
CREATE OR REPLACE FUNCTION handle_template_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track changes if content actually changed
  IF (TG_OP = 'UPDATE' AND (
    OLD.name != NEW.name OR
    OLD.description != NEW.description OR
    OLD.expression != NEW.expression OR
    OLD.action != NEW.action OR
    OLD.action_parameters IS DISTINCT FROM NEW.action_parameters
  )) THEN
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
      NEW.display_order,
      auth.jwt()->>'email'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for version tracking
DROP TRIGGER IF EXISTS template_version_trigger ON waf_templates;
CREATE TRIGGER template_version_trigger
  BEFORE UPDATE ON waf_templates
  FOR EACH ROW
  EXECUTE FUNCTION handle_template_version();