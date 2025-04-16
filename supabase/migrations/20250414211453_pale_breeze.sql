/*
  # Add country configuration to WAF templates

  1. Changes
    - Add target_countries column to waf_templates table
    - Add target_countries to version history table
    - Update version tracking trigger
    - Update existing MC Providers and Countries template
  
  2. Notes
    - Uses JSONB array to store country codes
    - Maintains version history tracking
    - Default to ["AU"] for existing templates
*/

-- Add target_countries column to waf_templates
ALTER TABLE waf_templates
ADD COLUMN IF NOT EXISTS target_countries jsonb DEFAULT '["AU"]'::jsonb;

-- Add target_countries to version history table
ALTER TABLE waf_template_versions
ADD COLUMN IF NOT EXISTS target_countries jsonb;

-- Update version trigger function to include target_countries
CREATE OR REPLACE FUNCTION handle_template_version()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND (
    OLD.name != NEW.name OR
    OLD.description != NEW.description OR
    OLD.expression != NEW.expression OR
    OLD.action != NEW.action OR
    OLD.action_parameters IS DISTINCT FROM NEW.action_parameters OR
    OLD.target_countries IS DISTINCT FROM NEW.target_countries
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

-- Update the MC Providers and Countries template with dynamic country expression
UPDATE waf_templates
SET expression = '(ip.src.asnum in {7224 16509 14618 15169 8075 396982} and not cf.client.bot and not cf.verified_bot_category in {"Search Engine Crawler" "Search Engine Optimization" "Monitoring & Analytics" "Advertising & Marketing" "Page Preview" "Academic Research" "Security" "Accessibility" "Webhooks" "Feed Fetcher" "Aggregator"}) or (not ip.src.country in (select jsonb_array_elements_text(target_countries)) and not cf.client.bot and not cf.verified_bot_category in {"Search Engine Crawler" "Search Engine Optimization" "Monitoring & Analytics" "Advertising & Marketing" "Page Preview" "Academic Research" "Security" "Accessibility" "Webhooks" "Feed Fetcher" "Aggregator"} and not http.request.uri.path contains "acme-challenge")'
WHERE name = 'MC Providers and Countries';