/*
  # Update WAF templates order

  1. Changes
    - Reorder core WAF templates to match dashboard order:
      1. Good Bots Allow
      2. MC Providers and Countries
      3. MC Aggressive Crawlers
      4. MC VPNs and WP Login
      5. Block Web Hosts / WP Paths / TOR
    - Preserve existing template data and policies
    - Add order column to ensure consistent sorting
  
  2. Notes
    - Uses explicit ordering to maintain template sequence
*/

-- Add order column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'waf_templates' 
    AND column_name = 'display_order'
  ) THEN
    ALTER TABLE waf_templates
    ADD COLUMN display_order integer;
  END IF;
END $$;

-- Update core templates with correct order
UPDATE waf_templates
SET display_order = CASE name
  WHEN 'Good Bots Allow' THEN 1
  WHEN 'MC Providers and Countries' THEN 2
  WHEN 'MC Aggressive Crawlers' THEN 3
  WHEN 'MC VPNs and WP Login' THEN 4
  WHEN 'Block Web Hosts / WP Paths / TOR' THEN 5
  ELSE 100 -- Non-core templates go after core ones
END
WHERE is_core = true;