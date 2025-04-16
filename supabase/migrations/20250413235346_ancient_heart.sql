/*
  # Update WAF templates order

  1. Changes
    - Reorder core WAF templates to match dashboard order
    - Preserve existing template data and policies
    - Ensure consistent ordering across application
  
  2. Notes
    - Templates are ordered as:
      1. Good Bots Allow
      2. MC Providers and Countries
      3. MC Aggressive Crawlers
      4. MC VPNs and WP Login
      5. Block Web Hosts / WP Paths / TOR
*/

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS waf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL,
  expression text NOT NULL,
  action text NOT NULL,
  action_parameters jsonb,
  is_core boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE waf_templates ENABLE ROW LEVEL SECURITY;

-- Safely create policies if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'waf_templates' 
    AND policyname = 'Admin can manage all templates'
  ) THEN
    CREATE POLICY "Admin can manage all templates"
      ON waf_templates
      FOR ALL
      TO authenticated
      USING (auth.jwt()->>'email' = 'steve@shadowtek.com.au')
      WITH CHECK (auth.jwt()->>'email' = 'steve@shadowtek.com.au');
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'waf_templates' 
    AND policyname = 'Users can read templates'
  ) THEN
    CREATE POLICY "Users can read templates"
      ON waf_templates
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Delete existing core templates to reinsert in correct order
DELETE FROM waf_templates WHERE is_core = true;

-- Insert core templates in the correct order
INSERT INTO waf_templates (name, description, expression, action, action_parameters, is_core)
VALUES
  (
    'Good Bots Allow',
    'Allow access for verified good bots and specific user agents',
    '(cf.client.bot) or (cf.verified_bot_category in {"Search Engine Crawler" "Search Engine Optimization" "Monitoring & Analytics" "Advertising & Marketing" "Page Preview" "Academic Research" "Security" "Accessibility" "Webhooks" "Feed Fetcher"}) or (http.user_agent contains "letsencrypt" and http.request.uri.path contains "acme-challenge") or (http.user_agent contains "SMTP2GO") or (http.request.uri.path contains "webhooks")',
    'skip',
    '{"ruleset": "current", "phases": ["http_ratelimit", "http_request_sbfm", "http_request_firewall_managed"], "products": ["uaBlock", "zoneLockdown", "waf", "rateLimit", "bic", "hot", "securityLevel"]}',
    true
  ),
  (
    'MC Providers and Countries',
    'Apply managed challenge for specific providers and non-AU traffic',
    '(ip.src.asnum in {7224 16509 14618 15169 8075 396982} and not cf.client.bot and not cf.verified_bot_category in {"Search Engine Crawler" "Search Engine Optimization" "Monitoring & Analytics" "Advertising & Marketing" "Page Preview" "Academic Research" "Security" "Accessibility" "Webhooks" "Feed Fetcher" "Aggregator"}) or (not ip.src.country in {"AU"} and not cf.client.bot and not cf.verified_bot_category in {"Search Engine Crawler" "Search Engine Optimization" "Monitoring & Analytics" "Advertising & Marketing" "Page Preview" "Academic Research" "Security" "Accessibility" "Webhooks" "Feed Fetcher" "Aggregator"} and not http.request.uri.path contains "acme-challenge")',
    'managed_challenge',
    null,
    true
  ),
  (
    'MC Aggressive Crawlers',
    'Apply managed challenge for aggressive and unwanted crawlers',
    '(http.user_agent contains "yandex") or (http.user_agent contains "sogou") or (http.user_agent contains "semrush") or (http.user_agent contains "ahrefs") or (http.user_agent contains "baidu") or (http.user_agent contains "python-requests") or (http.user_agent contains "neevabot") or (http.user_agent contains "CF-UC") or (http.user_agent contains "sitelock") or (http.user_agent contains "crawl" and not cf.client.bot) or (http.user_agent contains "bot" and not cf.client.bot) or (http.user_agent contains "Bot" and not cf.client.bot) or (http.user_agent contains "Crawl" and not cf.client.bot) or (http.user_agent contains "spider" and not cf.client.bot) or (http.user_agent contains "mj12bot") or (http.user_agent contains "ZoominfoBot") or (http.user_agent contains "mojeek") or (ip.src.asnum in {135061 23724 4808} and http.user_agent contains "siteaudit")',
    'managed_challenge',
    null,
    true
  ),
  (
    'MC VPNs and WP Login',
    'Apply managed challenge for VPN providers and WordPress login attempts',
    '(ip.src.asnum in {60068 9009 16247 51332 212238 131199 22298 29761 62639 206150 210277 46562 8100 3214 206092 206074 206164 213074}) or (http.request.uri.path contains "wp-login")',
    'managed_challenge',
    null,
    true
  ),
  (
    'Block Web Hosts / WP Paths / TOR',
    'Block access from web hosts, sensitive WordPress paths, and TOR',
    '(ip.src.asnum in {26496 31815 18450 398101 50673 7393 14061 205544 199610 21501 16125 51540 264649 39020 30083 35540 55293 36943 32244 6724 63949 7203 201924 30633 208046 36352 25264 32475 23033 32475 212047 32475 31898 210920 211252 16276 23470 136907 12876 210558 132203 61317 212238 37963 13238 2639 20473 63018 395954 19437 207990 27411 53667 27176 396507 206575 20454 51167 60781 62240 398493 206092 63023 213230 26347 20738 45102 24940 57523 8100 8560 6939 14178 46606 197540 397630 9009 11878}) or (http.request.uri.path contains "xmlrpc") or (http.request.uri.path contains "wp-config") or (http.request.uri.path contains "wlwmanifest") or (cf.verified_bot_category in {"AI Crawler" "Other"}) or (ip.src.country in {"T1"})',
    'block',
    null,
    true
  );